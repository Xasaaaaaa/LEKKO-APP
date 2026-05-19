import asyncio
import json
import os
import asyncpg
from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

TOKEN = os.environ.get("BOT_TOKEN", "8492885588:AAFPmxL_u4elT0Z5qHVuP0-FicEjPpkp-Xc")
DATABASE_URL = os.environ.get("DATABASE_URL")
WEB_APP_URL = "https://golden-croquembouche-ecc3d2.netlify.app"

bot = Bot(token=TOKEN)
dp = Dispatcher()
db_pool = None


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
                created_at TIMESTAMP DEFAULT NOW()
            )
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


# HTTP endpoint — принимает данные от WebApp напрямую
async def handle_event(request):
    try:
        data = await request.json()
        print(f"📩 HTTP данные: {data}")
    except Exception as e:
        print(f"❌ Ошибка JSON: {e}")
        return web.Response(status=400, text="Bad JSON")

    event = data.get("type")
    username = data.get("user") or "Сотрудник"
    user_id = data.get("chat_id")
    lat = data.get("latitude")
    lon = data.get("longitude")

    if not user_id:
        return web.Response(status=400, text="No chat_id")

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

            await bot.send_message(
                chat_id=int(user_id),
                text=f"🟢 *{username} вышел на смену*\n🕒 Время: {data.get('time')}",
                parse_mode="Markdown"
            )
            if lat and lon:
                await bot.send_location(chat_id=int(user_id), latitude=float(lat), longitude=float(lon))

        elif event == "SHIFT_ENDED":
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE shifts SET end_time=$1, worked=$2
                    WHERE user_id=$3 AND end_time IS NULL
                    ORDER BY created_at DESC
                    LIMIT 1
                """, data.get("time"), data.get("worked"), int(user_id))

            await bot.send_message(
                chat_id=int(user_id),
                text=f"🔴 *{username} завершил смену*\n🕒 {data.get('time')}\n⏱ {data.get('worked')}",
                parse_mode="Markdown"
            )
            if lat and lon:
                await bot.send_location(chat_id=int(user_id), latitude=float(lat), longitude=float(lon))

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

            await bot.send_message(
                chat_id=int(user_id),
                text=(
                    f"🏥 *Новая аптека*\n"
                    f"🏪 {p.get('name')}\n"
                    f"👤 {p.get('lprName')}\n"
                    f"📞 {p.get('lprPhone')}\n"
                    f"💻 {p.get('software')}\n"
                    f"📊 {p.get('status') or '—'}\n"
                    f"💬 {p.get('comment') or '—'}"
                ),
                parse_mode="Markdown"
            )

    except Exception as e:
        print(f"❌ Ошибка обработки: {e}")
        return web.Response(status=500, text=str(e))

    return web.json_response({"ok": True})


async def main():
    await init_db()

    app_web = web.Application()
    app_web.router.add_post("/event", handle_event)

    runner = web.AppRunner(app_web)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 8080)))
    await site.start()

    print("✅ Сервер запущен")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())