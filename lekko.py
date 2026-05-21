import asyncio
import json
import os
import math
import asyncpg
import aiohttp
from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from datetime import datetime, timedelta

TOKEN = os.environ.get("BOT_TOKEN", "8492885588:AAFPmxL_u4elT0Z5qHVuP0-FicEjPpkp-Xc")
DATABASE_URL = os.environ.get("DATABASE_URL")
WEB_APP_URL = "https://fascinating-medovik-cbeefa.netlify.app"
ADMIN_ID = 7526702987

bot = Bot(token=TOKEN)
dp = Dispatcher()
db_pool = None


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
    print("✅ База данных готова")


@dp.message(CommandStart())
async def start(message: Message):
    print(f"👤 /start от {message.from_user.first_name}")
    async with db_pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO users (id, username, first_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE
            SET username = $2, first_name = $3
        """, message.from_user.id,
            message.from_user.username,
            message.from_user.first_name)

    kb = InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="🚀 Открыть LEKKO APP",
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]]
    )
    await message.answer(
        f"Привет, {message.from_user.first_name}! 👋\n"
        "Добро пожаловать в LEKKO APP",
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

    today = datetime.now().strftime("%Y-%m-%d")

    async with db_pool.acquire() as conn:
        active = await conn.fetch("""
            SELECT first_name, start_time FROM shifts
            WHERE date=$1 AND end_time IS NULL
        """, today)

        done = await conn.fetch("""
            SELECT first_name, start_time, end_time, worked, distance_km
            FROM shifts
            WHERE date=$1 AND end_time IS NOT NULL
        """, today)

        pharmacies = await conn.fetch("""
            SELECT first_name, name, status FROM pharmacies
            WHERE DATE(created_at) = $1::DATE
        """, today)

    text = f"📊 *Сводка за сегодня* ({datetime.now().strftime('%d.%m.%Y')})\n\n"

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
# /report — отчёт за неделю
# =========================

@dp.message(Command("report"))
async def cmd_report(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ У вас нет доступа к этой команде.")
        return

    await send_weekly_report()


# =========================
# АВТООТЧЁТ — пятница 18:30
# =========================

async def send_weekly_report():
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")

    async with db_pool.acquire() as conn:
        staff = await conn.fetch("""
            SELECT
                first_name,
                COUNT(*) as shifts_count,
                COUNT(CASE WHEN end_time IS NOT NULL THEN 1 END) as completed,
                SUM(CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 0 END) as total_distance
            FROM shifts
            WHERE date >= $1 AND date <= $2
            GROUP BY first_name
            ORDER BY shifts_count DESC
        """, week_ago, today)

        pharma = await conn.fetch("""
            SELECT
                first_name,
                COUNT(*) as total,
                COUNT(CASE WHEN status='deal' THEN 1 END) as deals,
                COUNT(CASE WHEN status='decline' THEN 1 END) as declines,
                COUNT(CASE WHEN status='inwork' THEN 1 END) as inwork,
                COUNT(CASE WHEN status='cold' THEN 1 END) as cold
            FROM pharmacies
            WHERE DATE(created_at) >= $1::DATE AND DATE(created_at) <= $2::DATE
            GROUP BY first_name
            ORDER BY total DESC
        """, week_ago, today)

    pharma_dict = {p['first_name']: p for p in pharma}

    text = (
        f"📈 *Еженедельный отчёт*\n"
        f"({(datetime.now() - timedelta(days=7)).strftime('%d.%m')} — "
        f"{datetime.now().strftime('%d.%m.%Y')})\n\n"
    )

    if not staff:
        text += "Нет данных за этот период."
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        return

    for i, s in enumerate(staff, 1):
        name = s['first_name']
        dist = f" | 📍 {round(s['total_distance'], 1)} км" if s['total_distance'] else ""
        text += f"{i}. *{name}*\n"
        text += f"   🕒 Смен: {s['shifts_count']} (завершено: {s['completed']}{dist})\n"

        p = pharma_dict.get(name)
        if p:
            text += (
                f"   🏥 Аптек: {p['total']} "
                f"(✅{p['deals']} ❌{p['declines']} 🔄{p['inwork']} ❄️{p['cold']})\n"
            )
        else:
            text += f"   🏥 Аптек: 0\n"
        text += "\n"

    total_shifts = sum(s['shifts_count'] for s in staff)
    total_pharma = sum(p['total'] for p in pharma)
    total_deals  = sum(p['deals'] for p in pharma)

    text += (
        f"📊 *Итого за неделю:*\n"
        f"   Смен: {total_shifts}\n"
        f"   Аптек: {total_pharma}\n"
        f"   Сделок: {total_deals}\n"
    )

    await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
    print("✅ Еженедельный отчёт отправлен")


async def scheduler():
    while True:
        now = datetime.now()
        # Пятница (weekday=4), 18:30
        if now.weekday() == 4 and now.hour == 18 and now.minute == 30:
            await send_weekly_report()
            await asyncio.sleep(60)
        await asyncio.sleep(30)


async def notify_admin(text, lat=None, lon=None):
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        if lat and lon:
            await bot.send_location(chat_id=ADMIN_ID, latitude=float(lat), longitude=float(lon))
    except Exception as e:
        print(f"❌ Ошибка отправки админу: {e}")


async def handle_options(request):
    return web.Response(headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


async def handle_event(request):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if request.method == "OPTIONS":
        return web.Response(headers=headers)

    try:
        data = await request.json()
        print(f"📩 HTTP данные: {data}")
    except Exception as e:
        print(f"❌ Ошибка JSON: {e}")
        return web.Response(status=400, text="Bad JSON", headers=headers)

    event    = data.get("type")
    username = data.get("user") or "Сотрудник"
    user_id  = data.get("chat_id")
    lat      = data.get("latitude")
    lon      = data.get("longitude")
    map_link = data.get("map")

    if not user_id:
        return web.Response(status=400, text="No chat_id", headers=headers)

    try:
        if event == "SHIFT_STARTED":
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO shifts
                    (user_id, first_name, start_time, latitude, longitude, map_link, date)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE::TEXT)
                """, int(user_id), username,
                    data.get("time"),
                    float(lat) if lat else None,
                    float(lon) if lon else None,
                    map_link)

            text = (
                f"🟢 *{username} вышел на смену*\n"
                f"🕒 Время: {data.get('time')}"
            )

            await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown")
            if lat and lon:
                await bot.send_location(chat_id=int(user_id), latitude=float(lat), longitude=float(lon))

            if int(user_id) != ADMIN_ID:
                await notify_admin(text, lat, lon)

        elif event == "SHIFT_ENDED":
            async with db_pool.acquire() as conn:
                shift = await conn.fetchrow("""
                    SELECT latitude, longitude FROM shifts
                    WHERE id = (
                        SELECT id FROM shifts
                        WHERE user_id=$1 AND end_time IS NULL
                        ORDER BY created_at DESC
                        LIMIT 1
                    )
                """, int(user_id))

                distance = None
                distance_text = ""
                if shift and shift["latitude"] and lat and lon:
                    distance = haversine(
                        shift["latitude"], shift["longitude"],
                        float(lat), float(lon)
                    )
                    distance_text = f"\n📍 Расстояние: *{distance} км*"

                await conn.execute("""
                    UPDATE shifts SET end_time=$1, worked=$2, distance_km=$3
                    WHERE id = (
                        SELECT id FROM shifts
                        WHERE user_id=$4 AND end_time IS NULL
                        ORDER BY created_at DESC
                        LIMIT 1
                    )
                """, data.get("time"), data.get("worked"), distance, int(user_id))

            text = (
                f"🔴 *{username} завершил смену*\n"
                f"🕒 Время: {data.get('time')}\n"
                f"⏱ Отработано: {data.get('worked')}"
                f"{distance_text}"
            )

            await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown")
            if lat and lon:
                await bot.send_location(chat_id=int(user_id), latitude=float(lat), longitude=float(lon))

            if int(user_id) != ADMIN_ID:
                await notify_admin(text, lat, lon)

        elif event == "PHARMACY_CREATED":
            p = data.get("data", {})

            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO pharmacies
                    (user_id, first_name, name, lpr_name, lpr_phone, software, status, comment, photos_count, latitude, longitude, map_link)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                """, int(user_id), username,
                    p.get("name"), p.get("lprName"), p.get("lprPhone"),
                    p.get("software"), p.get("status"), p.get("comment"),
                    p.get("photosCount", 0),
                    float(lat) if lat else None,
                    float(lon) if lon else None,
                    map_link)

            address_text = ""
            if lat and lon:
                address = await get_address(lat, lon)
                address_text = f"\n🗺 Адрес: {address}\n📌 {map_link}"

            text = (
                f"🏥 *Новая аптека от {username}*\n"
                f"🏪 Название: {p.get('name')}\n"
                f"👤 ЛПР: {p.get('lprName')}\n"
                f"📞 Телефон: {p.get('lprPhone')}\n"
                f"💻 Программа: {p.get('software')}\n"
                f"📊 Статус: {p.get('status') or '—'}\n"
                f"💬 Комментарий: {p.get('comment') or '—'}\n"
                f"📸 Фото: {p.get('photosCount')} шт."
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


async def main():
    await init_db()

    app_web = web.Application()
    app_web.router.add_post("/event", handle_event)
    app_web.router.add_options("/event", handle_options)

    runner = web.AppRunner(app_web)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 8080)))
    await site.start()

    print("✅ Сервер запущен")

    await asyncio.gather(
        dp.start_polling(bot),
        scheduler()
    )


if __name__ == "__main__":
    asyncio.run(main())