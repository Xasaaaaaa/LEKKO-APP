import asyncio
import json

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

TOKEN = "8492885588:AAFPmxL_u4elT0Z5qHVuP0-FicEjPpkp-Xc"
WEB_APP_URL = "https://golden-croquembouche-ecc3d2.netlify.app"

bot = Bot(token=TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть LEKKO APP",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            ]
        ]
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
    lat = data.get("latitude")
    lon = data.get("longitude")

    if event == "SHIFT_STARTED":

        await message.answer(
            f"🟢 *{username} вышел на смену*\n"
            f"🕒 Время: {data.get('time')}",
            parse_mode="Markdown"
        )

        await bot.send_location(
            chat_id=message.chat.id,
            latitude=float(lat),
            longitude=float(lon)
        )

    elif event == "SHIFT_ENDED":

        await message.answer(
            f"🔴 *{username} завершил смену*\n"
            f"🕒 Время: {data.get('time')}\n"
            f"⏱ Отработано: {data.get('worked')}",
            parse_mode="Markdown"
        )

        await bot.send_location(
            chat_id=message.chat.id,
            latitude=float(lat),
            longitude=float(lon)
        )

    elif event == "PHARMACY_CREATED":

        p = data.get("data", {})

        await message.answer(
            f"🏥 *Новая аптека*\n"
            f"🏪 Название: {p.get('name')}\n"
            f"👤 ЛПР: {p.get('lprName')}\n"
            f"📞 Телефон: {p.get('lprPhone')}\n"
            f"💻 Программа: {p.get('software')}\n"
            f"📸 Фото: {p.get('photosCount')} шт.",
            parse_mode="Markdown"
        )

    else:
        await message.answer(str(data))


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())