import asyncio
import logging

from aiogram import Bot, F, Router
from aiogram.filters import StateFilter
from aiogram.types import Message

from bot.config import Settings
from bot.database import Database
from bot.handlers.admin.intent_runner import execute_admin_intent
from bot.keyboards.admin_kb import admin_main_menu_kb
from bot.local_intents import format_openai_error, parse_local_intent
from bot.openai_voice import parse_text_intent, process_voice
from bot.telegram_files import download_telegram_file

logger = logging.getLogger(__name__)

router = Router()

DOWNLOAD_TIMEOUT_SEC = 25
OPENAI_TIMEOUT_SEC = 45

_SKIP_TEXTS = frozenset({"⚙️ Админка", "Записаться", "Моя запись"})

_HELP = (
    "Примеры команд текстом (без OpenAI):\n"
    "• покажи слоты / свободные слоты\n"
    "• записи / покажи записи\n"
    "• статистика\n"
    "• ожидают оплату\n"
    "• настройки\n"
    "• добавь слот 25.07.2026 15:00"
)


async def _reply_or_edit(status_msg: Message | None, message: Message, text: str, **kwargs) -> None:
    if status_msg:
        try:
            await status_msg.edit_text(text, **kwargs)
            return
        except Exception:
            pass
    await message.answer(text, **kwargs)


async def _download_voice(bot: Bot, settings: Settings, message: Message) -> bytes:
    tg_file = await bot.get_file(message.voice.file_id)
    return await download_telegram_file(settings, tg_file.file_path, timeout_sec=DOWNLOAD_TIMEOUT_SEC)


async def _resolve_intent(text: str, settings: Settings) -> dict:
    local = parse_local_intent(text)
    if local is not None:
        return local

    if not settings.openai_api_key:
        return {"intent": "unknown", "date": None, "time": None, "search": None}

    return await asyncio.wait_for(
        asyncio.to_thread(
            parse_text_intent,
            settings.openai_api_key,
            text,
            settings.https_proxy,
        ),
        timeout=OPENAI_TIMEOUT_SEC,
    )


async def _run_intent(
    message: Message,
    db: Database,
    settings: Settings,
    intent_data: dict,
    *,
    status_msg: Message | None = None,
    heard: str | None = None,
) -> None:
    if heard:
        await _reply_or_edit(status_msg, message, f"📝 «{heard}»")
    await execute_admin_intent(message, db, settings, intent_data)


@router.message(F.voice)
async def admin_voice(message: Message, bot: Bot, db: Database, settings: Settings) -> None:
    if not settings.openai_api_key:
        await message.answer(
            "Голос нужен OpenAI (Whisper) — с РФ-VPS только через прокси.\n"
            f"{_HELP}",
            reply_markup=admin_main_menu_kb(),
        )
        return

    status_msg = await message.answer("🎤 Слушаю…")

    try:
        audio_bytes = await asyncio.wait_for(
            _download_voice(bot, settings, message),
            timeout=DOWNLOAD_TIMEOUT_SEC,
        )
        text, intent_data = await asyncio.wait_for(
            asyncio.to_thread(
                process_voice,
                settings.openai_api_key,
                audio_bytes,
                settings.https_proxy,
            ),
            timeout=OPENAI_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        await _reply_or_edit(
            status_msg,
            message,
            "⏱ Таймаут OpenAI. Задайте OPENAI_HTTPS_PROXY или пишите текстом.\n" + _HELP,
            reply_markup=admin_main_menu_kb(),
        )
        return
    except Exception as exc:
        logger.exception("Voice command failed")
        await _reply_or_edit(
            status_msg,
            message,
            format_openai_error(exc) + "\n\n" + _HELP,
            reply_markup=admin_main_menu_kb(),
        )
        return

    if not text:
        await _reply_or_edit(
            status_msg,
            message,
            "Не расслышал. Говорите дольше или напишите текстом.",
            reply_markup=admin_main_menu_kb(),
        )
        return

    local = parse_local_intent(text)
    if local is not None:
        intent_data = local

    await _run_intent(message, db, settings, intent_data, status_msg=status_msg, heard=text)


@router.message(
    F.text.func(lambda t: bool(t and t.strip() and t not in _SKIP_TEXTS and not t.startswith("/"))),
    StateFilter(None),
)
async def admin_text_command(message: Message, db: Database, settings: Settings) -> None:
    text = (message.text or "").strip()
    local = parse_local_intent(text)
    if local is not None:
        await _run_intent(message, db, settings, local, heard=text)
        return

    if not settings.openai_api_key:
        await message.answer(
            f"Не понял команду.\n\n{_HELP}",
            reply_markup=admin_main_menu_kb(),
        )
        return

    status_msg = await message.answer("⏳ Обрабатываю…")
    try:
        intent_data = await _resolve_intent(text, settings)
    except asyncio.TimeoutError:
        await _reply_or_edit(
            status_msg,
            message,
            "⏱ Таймаут OpenAI. /voicecheck\n\n" + _HELP,
            reply_markup=admin_main_menu_kb(),
        )
        return
    except Exception as exc:
        logger.exception("Text command failed")
        await _reply_or_edit(
            status_msg,
            message,
            format_openai_error(exc) + "\n\n" + _HELP,
            reply_markup=admin_main_menu_kb(),
        )
        return

    await _run_intent(message, db, settings, intent_data, status_msg=status_msg, heard=text)
