import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
from aiogram.fsm.storage.memory import MemoryStorage

from bot.config import load_settings
from bot.database import Database
from bot.handlers import admin, channel, channel_member, user
from bot.local_guard import refuse_accidental_local_polling
from bot.middleware import InjectMiddleware
from bot.single_instance import acquire_single_instance_lock

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
    refuse_accidental_local_polling(settings.database_path)
    acquire_single_instance_lock(settings.database_path.parent)
    db = Database(settings.database_path)
    await db.init()

    available = await db.count_available_future_slots()
    logger.info("Database: %s", settings.database_path)
    logger.info("Available future slots in DB: %s", available)
    legacy = settings.database_path.parent.parent / "booking.db"
    if legacy.resolve() != settings.database_path.resolve() and legacy.is_file():
        logger.warning(
            "Legacy DB file exists (%s) — ensure DATABASE_PATH points to data/booking.db used by /anna admin",
            legacy,
        )

    bot = build_bot(settings)
    try:
        me = await bot.get_me()
        logger.info("Telegram connected: @%s (id=%s)", me.username, me.id)
    except Exception as exc:
        logger.error("Telegram connection failed: %s", exc)
        await bot.session.close()
        raise SystemExit(1) from exc

    dp = Dispatcher(storage=MemoryStorage())

    dp.update.middleware(InjectMiddleware(db, settings))

    dp.include_router(channel.router)
    dp.include_router(channel_member.router)
    dp.include_router(admin.router)
    dp.include_router(user.router)

    if settings.openai_api_key:
        logger.info("OpenAI voice commands: enabled")
    else:
        logger.info("OpenAI voice commands: disabled (no OPENAI_API_KEY)")

    logger.info("Photo booking bot started")
    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Webhook cleared — waiting before polling")
    await asyncio.sleep(5)
    await dp.start_polling(
        bot,
        allowed_updates=["message", "callback_query", "chat_member"],
    )


if __name__ == "__main__":
    asyncio.run(main())
