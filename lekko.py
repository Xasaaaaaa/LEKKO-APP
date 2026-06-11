import asyncio
import json
import os
import math
import asyncpg
import aiohttp
from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, MenuButtonWebApp
from datetime import datetime, timedelta, timezone

TOKEN = os.environ.get("BOT_TOKEN", "8492885588:AAFPmxL_u4elT0Z5qHVuP0-FicEjPpkp-Xc")
DATABASE_URL = os.environ.get("DATABASE_URL")
WEB_APP_URL = "https://joyful-gingersnap-8d8a6c.netlify.app"
ADMIN_ID = 7526702987

bot = Bot(token=TOKEN)
dp = Dispatcher()
db_pool = None

TZ_OFFSET = timedelta(hours=5) 

def now_local():
    return datetime.now(timezone.utc) + TZ_OFFSET


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return round(R * 2 * math.asin(math.sqrt(a)), 2)


async def get_address(lat, lon):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json",
                headers={"User-Agent": "LekkoApp/1.0"}
            ) as resp:
                geo = await resp.json()
                return geo.get("display_name", f"{lat}, {lon}")
    except:
        return f"{lat}, {lon}"


async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                user_id BIGINT,
                first_name TEXT,
                start_time TEXT,
                end_time TEXT,
                worked TEXT,
                latitude FLOAT,
                longitude FLOAT,
                map_link TEXT,
                date TEXT,
                distance_km FLOAT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("ALTER TABLE shifts ADD COLUMN IF NOT EXISTS distance_km FLOAT")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS pharmacies (
                id SERIAL PRIMARY KEY,
                user_id BIGINT,
                first_name TEXT,
                name TEXT,
                lpr_name TEXT,
                lpr_phone TEXT,
                software TEXT,
                status TEXT,
                comment TEXT,
                photos_count INT,
                latitude FLOAT,
                longitude FLOAT,
                map_link TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS latitude FLOAT")
        await conn.execute("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS longitude FLOAT")
        await conn.execute("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS map_link TEXT")
        await conn.execute("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS software_id TEXT")

    print("✅ База данных готова")


@dp.message(CommandStart())
async def start(message: Message):
    print(f"👤 /start от {message.from_user.first_name}")
    uname = message.from_user.username or "—"
    fname = message.from_user.first_name or "Сотрудник"
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO users (id, username, first_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE
            SET username = $2, first_name = $3
        """, message.from_user.id, uname, fname)

    try:
        await bot.set_chat_menu_button(
            chat_id=message.chat.id,
            menu_button=MenuButtonWebApp(text="🚀 LEKKO APP", web_app=WebAppInfo(url=WEB_APP_URL))
        )
    except Exception as e:
        print(f"⚠️ Ошибка установки MenuButton: {e}")

    kb = InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="🚀 Открыть LEKKO APP",
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]]
    )
    await message.answer(
        f"Привет, {fname}! 👋\n"
        "Добро пожаловать в LEKKO APP. Кнопка быстрого запуска теперь всегда под рукой внизу экрана!",
        reply_markup=kb
    )


# =========================
# /stats — сводка за сегодня
# =========================

@dp.message(Command("stats"))
async def cmd_stats(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ У вас нет доступа к этой команде.")
        return

    today = now_local().date()

    async with db_pool.acquire() as conn:
        active = await conn.fetch("""
            SELECT COALESCE(first_name, 'Неизвестный') as first_name, start_time FROM shifts
            WHERE date=$1::TEXT AND end_time IS NULL
        """, str(today))

        done = await conn.fetch("""
            SELECT COALESCE(first_name, 'Неизвестный') as first_name, start_time, end_time, worked, distance_km
            FROM shifts
            WHERE date=$1::TEXT AND end_time IS NOT NULL
        """, str(today))

        pharmacies = await conn.fetch("""
            SELECT COALESCE(first_name, 'Неизвестный') as first_name, name, status FROM pharmacies
            WHERE (created_at + INTERVAL '5 hours')::DATE = $1
        """, today)

    text = f"📊 *Сводка за сегодня* ({now_local().strftime('%d.%m.%Y')}, Ташкент)\n\n"

    if active:
        text += f"🟢 *Сейчас на смене ({len(active)}):*\n"
        for s in active:
            text += f"  • {s['first_name']} — с {s['start_time']}\n"
        text += "\n"
    else:
        text += "🟢 *Сейчас на смене:* никого\n\n"

    if done:
        text += f"✅ *Завершили смену ({len(done)}):*\n"
        for s in done:
            dist = f" | 📍 {s['distance_km']} км" if s['distance_km'] else ""
            text += f"  • {s['first_name']} — {s['start_time']}–{s['end_time']} ({s['worked']}{dist})\n"
        text += "\n"
    else:
        text += "✅ *Завершили смену:* никого\n\n"

    if pharmacies:
        text += f"🏥 *Аптек добавлено: {len(pharmacies)}*\n"
        for p in pharmacies:
            status_emoji = {
                "cold": "❄️", "inwork": "🔄",
                "deal": "✅", "decline": "❌"
            }.get(p['status'], "📋")
            text += f"  • {p['first_name']}: {p['name']} {status_emoji}\n"
    else:
        text += "🏥 *Аптек добавлено:* 0"

    await message.answer(text, parse_mode="Markdown")


# =========================
# /report — отчёт за текущую неделю (пн–вс)
# =========================

@dp.message(Command("report"))
async def cmd_report(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ У вас нет доступа к этой команде.")
        return
    await send_weekly_report()


# =========================
# /reportall — отчёт за всё время
# =========================

@dp.message(Command("reportall"))
async def cmd_reportall(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ У вас нет доступа к этой команде.")
        return
    await send_all_time_report()


# =========================
# ОТЧЁТ ЗА ВСЁ ВРЕМЯ
# =========================

async def send_all_time_report():
    async with db_pool.acquire() as conn:
        staff = await conn.fetch("""
            SELECT
                COALESCE(first_name, 'Неизвестный') as first_name,
                COUNT(*) as shifts_count,
                COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) as completed,
                SUM(CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 0 END) as total_distance
            FROM shifts
            GROUP BY first_name
            ORDER BY shifts_count DESC
        """)

        pharma = await conn.fetch("""
            SELECT COALESCE(first_name, 'Неизвестный') as first_name, COUNT(*) as total,
                   COUNT(CASE WHEN status='deal' THEN 1 END) as deals,
                   COUNT(CASE WHEN status='decline' THEN 1 END) as declines,
                   COUNT(CASE WHEN status='inwork' THEN 1 END) as inwork,
                   COUNT(CASE WHEN status='cold' THEN 1 END) as cold
            FROM pharmacies
            GROUP BY first_name
            ORDER BY total DESC
        """)

        pharma_dict = {p['first_name']: p for p in pharma}

    text = "📊 *Отчёт за всё время*\n\n"

    if not staff:
        text += "Нет данных."
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        return

    for i, s in enumerate(staff, 1):
        name = s['first_name']
        dist = f" | 📍 {round(s['total_distance'], 1)} км" if s['total_distance'] else ""
        text += f"{i}. *{name}*\n"
        text += f"  🕒 Смен: {s['shifts_count']} (завершено: {s['completed']}{dist})\n"
        p = pharma_dict.get(name)
        if p:
            text += (
                f"  🏥 Аптек: {p['total']} "
                f"(✅{p['deals']} ❌{p['declines']} 🔄{p['inwork']} ❄️{p['cold']})\n"
            )
        else:
            text += f"  🏥 Аптек: 0\n"
        text += "\n"

    total_shifts = sum(s['shifts_count'] for s in staff)
    total_pharma = sum(p['total'] for p in pharma)
    total_deals = sum(p['deals'] for p in pharma)

    text += (
        f"📊 *Итого за всё время:*\n"
        f"  Смен: {total_shifts}\n"
        f"  Аптек: {total_pharma}\n"
        f"  Сделок: {total_deals}\n"
    )

    await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
    print("✅ Отчёт за всё время отправлен")


# =========================
# ЕЖЕНЕДЕЛЬНЫЙ ОТЧЁТ (текущая неделя пн–вс)
# =========================

async def send_weekly_report():
    local_now = now_local()
    week_start = (local_now - timedelta(days=local_now.weekday())).date()
    week_end = local_now.date()

    async with db_pool.acquire() as conn:
        staff = await conn.fetch("""
            SELECT
                COALESCE(first_name, 'Неизвестный') as first_name,
                COUNT(*) as shifts_count,
                COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) as completed,
                SUM(CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 0 END) as total_distance
            FROM shifts
            WHERE date >= $1::TEXT AND date <= $2::TEXT
            GROUP BY first_name
            ORDER BY shifts_count DESC
        """, str(week_start), str(week_end))

        pharma = await conn.fetch("""
            SELECT COALESCE(first_name, 'Неизвестный') as first_name, COUNT(*) as total,
                   COUNT(CASE WHEN status='deal' THEN 1 END) as deals,
                   COUNT(CASE WHEN status='decline' THEN 1 END) as declines,
                   COUNT(CASE WHEN status='inwork' THEN 1 END) as inwork,
                   COUNT(CASE WHEN status='cold' THEN 1 END) as cold
            FROM pharmacies
            WHERE (created_at + INTERVAL '5 hours')::DATE >= $1
              AND (created_at + INTERVAL '5 hours')::DATE <= $2
            GROUP BY first_name
            ORDER BY total DESC
        """, week_start, week_end)

        pharma_dict = {p['first_name']: p for p in pharma}

    text = (
        f"📈 *Еженедельный отчёт*\n"
        f"({week_start.strftime('%d.%m')} — {week_end.strftime('%d.%m.%Y')}, Ташкент)\n\n"
    )

    if not staff:
        text += "Нет данных за этот период."
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        return

    for i, s in enumerate(staff, 1):
        name = s['first_name']
        dist = f" | 📍 {round(s['total_distance'], 1)} км" if s['total_distance'] else ""
        text += f"{i}. *{name}*\n"
        text += f"  🕒 Смен: {s['shifts_count']} (завершено: {s['completed']}{dist})\n"
        p = pharma_dict.get(name)
        if p:
            text += (
                f"  🏥 Аптек: {p['total']} "
                f"(✅{p['deals']} ❌{p['declines']} 🔄{p['inwork']} ❄️{p['cold']})\n"
            )
        else:
            text += f"  🏥 Аптек: 0\n"
        text += "\n"

    total_shifts = sum(s['shifts_count'] for s in staff)
    total_pharma = sum(p['total'] for p in pharma)
    total_deals = sum(p['deals'] for p in pharma)

    text += (
        f"📊 *Итого за неделю:*\n"
        f"  Смен: {total_shifts}\n"
        f"  Аптек: {total_pharma}\n"
        f"  Сделок: {total_deals}\n"
    )

    await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
    print("✅ Еженедельный отчёт отправлен")


# =========================
# ПЛАНИРОВЩИК — пятница 18:30
# =========================

async def scheduler():
    while True:
        local_now = now_local()
        if local_now.weekday() == 4 and local_now.hour == 18 and local_now.minute == 30:
            try:
                await send_weekly_report()
            except Exception as e:
                print(f"Ошибка автоотчёта: {e}")
            await asyncio.sleep(60) 
        await asyncio.sleep(30)


async def notify_admin(text, lat=None, lon=None):
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        if lat and lon:
            await bot.send_location(chat_id=ADMIN_ID, latitude=float(lat), longitude=float(lon))
    except Exception as e:
        print(f"Ошибка уведомления админа: {e}")


# =========================
# WEB SERVER & WEBHOOK HANDLE
# =========================

async def handle_event(request):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=headers)

    try:
        data = await request.json()
        event_type = data.get("event")
        user_data = data.get("user") or {}
        user_id = data.get("chat_id") or user_data.get("id")
        first_name = user_data.get("first_name") or "Сотрудник"

        if not user_id:
            return web.json_response({"ok": False, "error": "No chat_id found"}, headers=headers)

        lat = data.get("latitude")
        lon = data.get("longitude")
        map_link = data.get("map")

        # -------------------------
        # НАЧАЛО СМЕНЫ
        # -------------------------
        if event_type == "shift_start":
            today_str = now_local().date().strftime("%Y-%m-%d")
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO shifts (user_id, first_name, start_time, latitude, longitude, map_link, date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, int(user_id), first_name, data.get("startTime"),
                    float(lat) if lat else None, float(lon) if lon else None, map_link, today_str)

            location_text = f"\n📍 [Открыть локацию начала смены на карте]({map_link})" if map_link else ""
            text = (
                f"🟢 *Смена открыта!*\n"
                f"👤 Сотрудник: {first_name}\n"
                f"🕒 Время начала: {data.get('startTime')}{location_text}"
            )
            await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown", disable_web_page_preview=True)
            if int(user_id) != ADMIN_ID:
                await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown", disable_web_page_preview=True)

        # -------------------------
        # ЗАВЕРШЕНИЕ СМЕНЫ
        # -------------------------
        elif event_type == "shift_end":
            today_str = now_local().date().strftime("%Y-%m-%d")
            distance = 0.0

            async with db_pool.acquire() as conn:
                last_shift = await conn.fetchrow("""
                    SELECT id, latitude, longitude FROM shifts
                    WHERE user_id=$1 AND date=$2 AND end_time IS NULL
                    ORDER BY id DESC LIMIT 1
                """, int(user_id), today_str)

                if last_shift and last_shift['latitude'] and lat:
                    distance = haversine(last_shift['latitude'], last_shift['longitude'], float(lat), float(lon))

                if last_shift:
                    await conn.execute("""
                        UPDATE shifts SET end_time=$1, worked=$2, latitude=$3, longitude=$4, map_link=$5, distance_km=$6
                        WHERE id=$7
                    """, data.get("endTime"), data.get("worked"),
                        float(lat) if lat else None, float(lon) if lon else None, map_link, distance, last_shift['id'])
                else:
                    await conn.execute("""
                        INSERT INTO shifts (user_id, first_name, end_time, worked, latitude, longitude, map_link, date, distance_km)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """, int(user_id), first_name, data.get("endTime"), data.get("worked"),
                        float(lat) if lat else None, float(lon) if lon else None, map_link, today_str, distance)

            location_text = f"\n📍 [Открыть локацию закрытия смены на карте]({map_link})" if map_link else ""
            text = (
                f"🔴 *Смена завершена!*\n"
                f"👤 Сотрудник: {first_name}\n"
                f"⏱ Отработано: {data.get('worked')}\n"
                f"📈 Пройдено расстояние: {distance} км{location_text}"
            )
            await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown", disable_web_page_preview=True)
            if int(user_id) != ADMIN_ID:
                await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown", disable_web_page_preview=True)

        # -------------------------
        # ДОБАВЛЕНИЕ АПТЕКИ
        # -------------------------
        elif event_type == "pharmacy_add":
            sw_name = data.get("software")
            sw_id = data.get("softwareId")

            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO pharmacies (user_id, first_name, name, lpr_name, lpr_phone, software, software_id, status, comment, photos_count, latitude, longitude, map_link)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """, int(user_id), first_name, data.get("name"), data.get("lprName"), data.get("lprPhone"),
                    sw_name, sw_id, data.get("status"), data.get("comment"), int(data.get("photosCount", 0)),
                    float(lat) if lat else None, float(lon) if lon else None, map_link)

            address_text = ""
            if lat and lon:
                addr = await get_address(lat, lon)
                address_text = f"\n📍 Адрес: {addr}\n🗺 [Google Maps]({map_link})"

            sw_display = f"{sw_name} (🆔 ID: {sw_id})" if sw_id else sw_name

            text = (
                f"🏥 *Добавлена новая аптека!*\n"
                f"👤 Сотрудник: {first_name}\n"
                f"🏪 Название: {data.get('name')}\n"
                f"👤 ЛПР: {data.get('lprName')}\n"
                f"📞 Телефон: {data.get('lprPhone')}\n"
                f"💻 Программа: {sw_display}\n"
                f"📊 Статус: {data.get('status') or '—'}\n"
                f"💬 Комментарий: {data.get('comment') or '—'}\n"
                f"📸 Фото: {data.get('photosCount')} шт."
                f"{address_text}"
            )

            await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown")
            if lat and lon:
                await bot.send_location(chat_id=int(user_id), latitude=float(lat), longitude=float(lon))

            if int(user_id) != ADMIN_ID:
                await notify_admin(text, lat, lon)

    except Exception as e:
        print(f"❌ Ошибка обработки: {e}")
        return web.Response(status=500, text=str(e), headers=headers)

    return web.json_response({"ok": True}, headers=headers)


async def handle_data(request):
    h = cors_headers()
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=h)
    user_id = request.query.get("user_id")
    if not user_id:
        return web.json_response({"ok": False, "error": "No user_id"}, headers=h)
    try:
        async with db_pool.acquire() as conn:
            pharmacies = await conn.fetch("""
                SELECT id, name, lpr_name, lpr_phone, software, software_id,
                       status, comment, photos_count, latitude, longitude, map_link, created_at
                FROM pharmacies WHERE user_id=$1 ORDER BY created_at DESC
            """, int(user_id))
            shifts = await conn.fetch("""
                SELECT id, start_time, end_time, worked, latitude, longitude,
                       map_link, date, distance_km, created_at
                FROM shifts WHERE user_id=$1 ORDER BY created_at DESC
            """, int(user_id))
            active_shift = await conn.fetchrow("""
                SELECT id, created_at, map_link FROM shifts
                WHERE user_id=$1 AND end_time IS NULL ORDER BY id DESC LIMIT 1
            """, int(user_id))
            today = now_local().date()
            pharma_today = await conn.fetchval("""
                SELECT COUNT(*) FROM pharmacies
                WHERE user_id=$1 AND (created_at + INTERVAL '5 hours')::DATE=$2
            """, int(user_id), today)

        def fmt_p(p):
            local = p['created_at'] + TZ_OFFSET
            return {
                "id": p['id'], "name": p['name'], "lprName": p['lpr_name'],
                "lprPhone": p['lpr_phone'], "software": p['software'],
                "softwareId": p['software_id'], "status": p['status'],
                "comment": p['comment'], "photosCount": p['photos_count'],
                "latitude": p['latitude'], "longitude": p['longitude'],
                "map": p['map_link'], "date": local.strftime("%Y-%m-%d"),
                "time": local.strftime("%H:%M"),
                "timestamp": int(p['created_at'].timestamp() * 1000)
            }

        def fmt_s(s):
            return {
                "id": s['id'], "date": s['date'], "start": s['start_time'],
                "end": s['end_time'], "duration": s['worked'],
                "distanceKm": s['distance_km'], "startMap": s['map_link'],
                "startTimestamp": int(s['created_at'].timestamp() * 1000)
            }

        return web.json_response({"ok": True,
            "pharmacies": [fmt_p(p) for p in pharmacies],
            "shifts": [fmt_s(s) for s in shifts if s['end_time']],
            "activeShift": {
                "startTimestamp": int(active_shift['created_at'].timestamp() * 1000),
                "startMap": active_shift['map_link']
            } if active_shift else None,
            "dayFact": pharma_today
        }, headers=h)
    except Exception as e:
        print(f"❌ handle_data error: {e}")
        return web.json_response({"ok": False, "error": str(e)}, headers=h)


async def handle_admin_users(request):
    h = cors_headers()
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=h)
    if not check_token(request):
        return web.json_response({"ok": False, "error": "Unauthorized"}, status=401, headers=h)
    async with db_pool.acquire() as conn:
        users = await conn.fetch("""
            SELECT u.id, 
                COALESCE(u.username, '—') as username, 
                COALESCE(u.first_name, 'Неизвестный') as first_name, 
                u.created_at,
                COUNT(DISTINCT s.id) as shifts_total,
                COUNT(DISTINCT CASE WHEN s.end_time IS NOT NULL THEN s.id END) as shifts_done,
                COUNT(DISTINCT p.id) as pharmas_total,
                COUNT(DISTINCT CASE WHEN p.status='deal' THEN p.id END) as deals,
                MAX((s.created_at + INTERVAL '5 hours')) as last_shift
            FROM users u
            LEFT JOIN shifts s ON s.user_id = u.id
            LEFT JOIN pharmacies p ON p.user_id = u.id
            GROUP BY u.id, u.username, u.first_name, u.created_at
            ORDER BY pharmas_total DESC
        """)
    result = [{
        "id": str(r['id']),
        "username": r['username'],
        "first_name": r['first_name'],
        "created_at": (r['created_at'] + TZ_OFFSET).strftime("%d.%m.%Y") if r['created_at'] else "—",
        "shifts_total": r['shifts_total'],
        "shifts_done": r['shifts_done'],
        "pharmas_total": r['pharmas_total'],
        "deals": r['deals'],
        "last_shift": r['last_shift'].strftime("%d.%m.%Y %H:%M") if r['last_shift'] else "—"
    } for r in users]
    return web.json_response({"ok": True, "users": result}, headers=h)


async def handle_admin_pharmacies(request):
    h = cors_headers()
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=h)
    if not check_token(request):
        return web.json_response({"ok": False, "error": "Unauthorized"}, status=401, headers=h)
    user_id = request.query.get("user_id")
    async with db_pool.acquire() as conn:
        if user_id:
            rows = await conn.fetch("""
                SELECT p.*, (p.created_at + INTERVAL '5 hours') as local_time,
                COALESCE(p.first_name, 'Неизвестный') as agent_name
                FROM pharmacies p WHERE p.user_id=$1 ORDER BY p.created_at DESC
            """, int(user_id))
        else:
            rows = await conn.fetch("""
                SELECT p.*, (p.created_at + INTERVAL '5 hours') as local_time,
                COALESCE(p.first_name, 'Неизвестный') as agent_name
                FROM pharmacies p ORDER BY p.created_at DESC LIMIT 200
            """)
    result = [{
        "id": r['id'],
        "first_name": r['agent_name'],
        "name": r['name'] or "—",
        "lpr_name": r['lpr_name'] or "—",
        "lpr_phone": r['lpr_phone'] or "—",
        "software": r['software'] or "—",
        "software_id": r['software_id'] or "",
        "status": r['status'] or "cold",
        "comment": r['comment'] or "",
        "map_link": r['map_link'] or "",
        "date": r['local_time'].strftime("%d.%m.%Y") if r['local_time'] else "—",
        "time": r['local_time'].strftime("%H:%M") if r['local_time'] else "—"
    } for r in rows]
    return web.json_response({"ok": True, "pharmacies": result}, headers=h)


async def handle_admin_shifts(request):
    h = cors_headers()
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=h)
    if not check_token(request):
        return web.json_response({"ok": False, "error": "Unauthorized"}, status=401, headers=h)
    user_id = request.query.get("user_id")
    async with db_pool.acquire() as conn:
        if user_id:
            rows = await conn.fetch("""
                SELECT s.*, COALESCE(s.first_name, 'Неизвестный') as agent_name 
                FROM shifts s WHERE s.user_id=$1 ORDER BY s.created_at DESC
            """, int(user_id))
        else:
            rows = await conn.fetch("""
                SELECT s.*, COALESCE(s.first_name, 'Неизвестный') as agent_name 
                FROM shifts s ORDER BY s.created_at DESC LIMIT 100
            """)
    result = [{
        "id": r['id'],
        "first_name": r['agent_name'],
        "date": r['date'] or "—",
        "start_time": r['start_time'] or "—",
        "end_time": r['end_time'],
        "worked": r['worked'] or "—",
        "distance_km": r['distance_km'] or 0.0,
        "map_link": r['map_link'] or ""
    } for r in rows]
    return web.json_response({"ok": True, "shifts": result}, headers=h)


async def handle_admin_stats(request):
    h = cors_headers()
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=h)
    if not check_token(request):
        return web.json_response({"ok": False, "error": "Unauthorized"}, status=401, headers=h)
    today = now_local().date()
    week_start = (now_local() - timedelta(days=now_local().weekday())).date()
    async with db_pool.acquire() as conn:
        today_pharmas = await conn.fetchval("""
            SELECT COUNT(*) FROM pharmacies
            WHERE (created_at + INTERVAL '5 hours')::DATE = $1
        """, today) or 0
        today_shifts = await conn.fetchval("""
            SELECT COUNT(*) FROM shifts WHERE date=$1::TEXT AND end_time IS NOT NULL
        """, str(today)) or 0
        active_shifts = await conn.fetchval("""
            SELECT COUNT(*) FROM shifts WHERE end_time IS NULL
        """) or 0
        week_pharmas = await conn.fetchval("""
            SELECT COUNT(*) FROM pharmacies
            WHERE (created_at + INTERVAL '5 hours')::DATE >= $1
        """, week_start) or 0
        total_pharmas = await conn.fetchval("SELECT COUNT(*) FROM pharmacies") or 0
        total_users = await conn.fetchval("SELECT COUNT(*) FROM users") or 0
    return web.json_response({"ok": True, "stats": {
        "today_pharmas": today_pharmas,
        "today_shifts": today_shifts,
        "active_shifts": active_shifts,
        "week_pharmas": week_pharmas,
        "total_pharmas": total_pharmas,
        "total_users": total_users
    }}, headers=h)


@dp.message(Command("users"))
async def cmd_users(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ Нет доступа.")
        return
    async with db_pool.acquire() as conn:
        users = await conn.fetch("SELECT id, username, COALESCE(first_name, 'Неизвестный') as first_name, created_at FROM users ORDER BY created_at DESC")
        counts = await conn.fetch("""
            SELECT u.id,
                COUNT(DISTINCT s.id) as shifts,
                COUNT(DISTINCT p.id) as pharmas
            FROM users u
            LEFT JOIN shifts s ON s.user_id = u.id
            LEFT JOIN pharmacies p ON p.user_id = u.id
            GROUP BY u.id
        """)
    counts_dict = {r['id']: r for r in counts}
    text = f"👥 *Сотрудники ({len(users)}):*\n\n"
    for u in users:
        c = counts_dict.get(u['id'], {})
        uname = f"@{u['username']}" if u['username'] else f"id{u['id']}"
        text += (
            f"• *{u['first_name']}* ({uname})\n"
            f"  🕒 Смен: {c.get('shifts',0)} | 🏥 Аптек: {c.get('pharmas',0)}\n"
        )
    await message.answer(text, parse_mode="Markdown")


@dp.message(Command("pharmacy"))
async def cmd_pharmacy(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ Нет доступа.")
        return
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: /pharmacy Имя\nПример: /pharmacy Xas")
        return
    name_filter = args[1].strip()
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT name, lpr_name, lpr_phone, software, status, comment, map_link,
                   (created_at + INTERVAL '5 hours') as created_local
            FROM pharmacies
            WHERE LOWER(first_name) LIKE LOWER($1)
            ORDER BY created_at DESC
            LIMIT 20
        """, f"%{name_filter}%")
    if not rows:
        await message.answer(f"❌ Аптек для сотрудника *{name_filter}* не найдено.", parse_mode="Markdown")
        return
    status_emoji = {"cold": "❄️", "inwork": "🔄", "deal": "✅", "decline": "❌"}
    text = f"🏥 *Аптеки сотрудника {name_filter} ({len(rows)}):*\n\n"
    for r in rows:
        date_str = r['created_local'].strftime("%d.%m %H:%M")
        map_part = f" | [📍]({r['map_link']})" if r['map_link'] else ""
        text += (
            f"{status_emoji.get(r['status'],'📋')} *{r['name']}* ({date_str}{map_part})\n"
            f"  👤 {r['lpr_name']} | 📞 {r['lpr_phone']}\n"
            f"  💻 {r['software']}\n"
        )
        if r['comment']:
            text += f"  💬 {r['comment']}\n"
        text += "\n"
    await message.answer(text, parse_mode="Markdown", disable_web_page_preview=True)


ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "lekko_admin_2026")

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token"
    }

def check_token(request):
    token = request.headers.get("X-Admin-Token") or request.query.get("token")
    return token == ADMIN_TOKEN


async def main():
    await init_db()

    app_web = web.Application()
    app_web.router.add_post("/event", handle_event)
    app_web.router.add_route("OPTIONS", "/event", handle_event)
    app_web.router.add_get("/data", handle_data)
    app_web.router.add_route("OPTIONS", "/data", handle_data)
    app_web.router.add_get("/admin/users", handle_admin_users)
    app_web.router.add_route("OPTIONS", "/admin/users", handle_admin_users)
    app_web.router.add_get("/admin/pharmacies", handle_admin_pharmacies)
    app_web.router.add_route("OPTIONS", "/admin/pharmacies", handle_admin_pharmacies)
    app_web.router.add_get("/admin/shifts", handle_admin_shifts)
    app_web.router.add_route("OPTIONS", "/admin/shifts", handle_admin_shifts)
    app_web.router.add_get("/admin/stats", handle_admin_stats)
    app_web.router.add_route("OPTIONS", "/admin/stats", handle_admin_stats)

    runner = web.AppRunner(app_web)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 8080)))

    asyncio.create_task(site.start())
    asyncio.create_task(scheduler())
    print("🚀 Веб-сервер запущен")

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())