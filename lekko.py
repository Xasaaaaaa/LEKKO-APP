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


# =========================
# ИНИЦИАЛИЗАЦИЯ БД
# =========================

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


# =========================
# БОТ
# =========================

@dp.message(CommandStart())
async def start(message: Message):

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


@dp.message(F.web_app_data)
async def web_app_data(message: Message):

    data = json.loads(message.web_app_data.data)
    event = data.get("type")
    username = data.get("user") or "Сотрудник"
    user_id = message.from_user.id
    lat = data.get("latitude")
    lon = data.get("longitude")

    if event == "SHIFT_STARTED":

        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO shifts
                (user_id, first_name, start_time, latitude, longitude, map_link, date)
                VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE::TEXT)
            """, user_id, username,
                data.get("time"),
                float(lat) if lat else None,
                float(lon) if lon else None,
                data.get("map"))

        await message.answer(
            f"🟢 *{username} вышел на смену*\n"
            f"🕒 Время: {data.get('time')}",
            parse_mode="Markdown"
        )

        if lat and lon:
            await bot.send_location(
                chat_id=message.chat.id,
                latitude=float(lat),
                longitude=float(lon)
            )

    elif event == "SHIFT_ENDED":

        async with db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE shifts SET end_time=$1, worked=$2, latitude=$3, longitude=$4, map_link=$5
                WHERE user_id=$6 AND end_time IS NULL
                ORDER BY created_at DESC
                LIMIT 1
            """, data.get("time"),
                data.get("worked"),
                float(lat) if lat else None,
                float(lon) if lon else None,
                data.get("map"),
                user_id)

        await message.answer(
            f"🔴 *{username} завершил смену*\n"
            f"🕒 Время: {data.get('time')}\n"
            f"⏱ Отработано: {data.get('worked')}",
            parse_mode="Markdown"
        )

        if lat and lon:
            await bot.send_location(
                chat_id=message.chat.id,
                latitude=float(lat),
                longitude=float(lon)
            )

    elif event == "PHARMACY_CREATED":

        p = data.get("data", {})

        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO pharmacies
                (user_id, first_name, name, lpr_name, lpr_phone, software, status, comment, photos_count)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """, user_id, username,
                p.get("name"),
                p.get("lprName"),
                p.get("lprPhone"),
                p.get("software"),
                p.get("status"),
                p.get("comment"),
                p.get("photosCount", 0))

        await message.answer(
            f"🏥 *Новая аптека*\n"
            f"🏪 Название: {p.get('name')}\n"
            f"👤 ЛПР: {p.get('lprName')}\n"
            f"📞 Телефон: {p.get('lprPhone')}\n"
            f"💻 Программа: {p.get('software')}\n"
            f"📊 Статус: {p.get('status') or '—'}\n"
            f"💬 Комментарий: {p.get('comment') or '—'}\n"
            f"📸 Фото: {p.get('photosCount')} шт.",
            parse_mode="Markdown"
        )

    else:
        await message.answer(str(data))


# =========================
# HTTP СЕРВЕР
# =========================

async def handle_stats(request):
    user_id = request.rel_url.query.get("user_id")
    if not user_id:
        return web.json_response({"error": "no user_id"}, status=400)

    async with db_pool.acquire() as conn:
        shifts = await conn.fetch("""
            SELECT * FROM shifts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50
        """, int(user_id))

        pharmacies = await conn.fetch("""
            SELECT * FROM pharmacies WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50
        """, int(user_id))

    return web.json_response({
        "shifts":            [dict(s) for s in shifts],
        "pharmacies":        [dict(p) for p in pharmacies],
        "total_shifts":      len(shifts),
        "total_pharmacies":  len(pharmacies),
    })


async def main():
    await init_db()

    app_web = web.Application()
    app_web.router.add_get("/stats", handle_stats)

    runner = web.AppRunner(app_web)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 8080)))
    await site.start()

    print("✅ Сервер запущен")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())