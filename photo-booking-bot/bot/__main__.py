import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
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


async def main() -> None:
    settings = load_settings()
    db = Database(settings.database_path)
    await db.init()

    session = AiohttpSession(proxy=settings.https_proxy) if settings.https_proxy else None
    bot = Bot(token=settings.bot_token, session=session)
    dp = Dispatcher(storage=MemoryStorage())

    dp.update.middleware(InjectMiddleware(db, settings))

    dp.include_router(admin.router)
    dp.include_router(user.router)

    logger.info("Photo booking bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
