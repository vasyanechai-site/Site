import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
from aiogram.fsm.storage.memory import MemoryStorage

from bot.config import load_settings
from bot.database import Database
from bot.handlers import admin, user
from bot.middleware import InjectMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def build_bot(settings) -> Bot:
    if settings.telegram_api_base:
        session = AiohttpSession(
            api=TelegramAPIServer.from_base(settings.telegram_api_base),
        )
        host = settings.telegram_api_base.split("/")[2]
        logger.info("Telegram API via Cloudflare proxy (%s)", host)
        return Bot(token=settings.bot_token, session=session)
    if settings.https_proxy:
        session = AiohttpSession(proxy=settings.https_proxy)
        logger.info("Telegram API via HTTPS proxy")
        return Bot(token=settings.bot_token, session=session)
    logger.info("Telegram API direct (api.telegram.org)")
    return Bot(token=settings.bot_token)


async def main() -> None:
    settings = load_settings()
    db = Database(settings.database_path)
    await db.init()

    bot = build_bot(settings)
    dp = Dispatcher(storage=MemoryStorage())

    dp.update.middleware(InjectMiddleware(db, settings))

    dp.include_router(user.router)
    dp.include_router(admin.router)

    logger.info("Photo booking bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
