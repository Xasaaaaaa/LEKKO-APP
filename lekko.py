import asyncio
import json
import os
import math
import asyncpg
from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

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
        await conn.execute("""
            ALTER TABLE shifts ADD COLUMN IF NOT EXISTS distance_km FLOAT
        """)
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
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
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


async def notify_admin(text, lat=None, lon=None):
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="Markdown")
        if lat and lon:
            await bot.send_location(chat_id=ADMIN_ID, latitude=float(lat), longitude=float(lon))
    except Exception as e:
        print(f"❌ Ошибка отправки админу: {e}")


async def handle_options(request):
    return web.Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }
    )


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

    event = data.get("type")
    username = data.get("user") or "Сотрудник"
    user_id = data.get("chat_id")
    lat = data.get("latitude")
    lon = data.get("longitude")

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
                    data.get("map"))

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
                    (user_id, first_name, name, lpr_name, lpr_phone, software, status, comment, photos_count)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """, int(user_id), username,
                    p.get("name"), p.get("lprName"), p.get("lprPhone"),
                    p.get("software"), p.get("status"), p.get("comment"),
                    p.get("photosCount", 0))

            text = (
                f"🏥 *Новая аптека от {username}*\n"
                f"🏪 Название: {p.get('name')}\n"
                f"👤 ЛПР: {p.get('lprName')}\n"
                f"📞 Телефон: {p.get('lprPhone')}\n"
                f"💻 Программа: {p.get('software')}\n"
                f"📊 Статус: {p.get('status') or '—'}\n"
                f"💬 Комментарий: {p.get('comment') or '—'}\n"
                f"📸 Фото: {p.get('photosCount')} шт."
            )

            await bot.send_message(chat_id=int(user_id), text=text, parse_mode="Markdown")

            if int(user_id) != ADMIN_ID:
                await notify_admin(text)

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
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())