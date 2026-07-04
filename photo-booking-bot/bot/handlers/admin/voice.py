import asyncio
import io
import logging
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.types import Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards.admin_kb import admin_main_menu_kb, admin_slots_menu_kb
from bot.openai_voice import process_voice
from bot.utils import format_slot_datetime, parse_slot_datetime

logger = logging.getLogger(__name__)

router = Router()

DOWNLOAD_TIMEOUT_SEC = 25
OPENAI_TIMEOUT_SEC = 45


async def _download_voice(bot: Bot, message: Message) -> bytes:
    file = await bot.get_file(message.voice.file_id)
    buf = io.BytesIO()
    await bot.download_file(file.file_path, buf)
    data = buf.getvalue()
    if not data:
        raise ValueError("Пустой файл голосового сообщения")
    return data


async def _reply_or_edit(status_msg: Message | None, message: Message, text: str, **kwargs) -> None:
    if status_msg:
        try:
            await status_msg.edit_text(text, **kwargs)
            return
        except Exception:
            pass
    await message.answer(text, **kwargs)


@router.message(F.voice)
async def admin_voice(message: Message, bot: Bot, db: Database, settings: Settings) -> None:
    if not settings.openai_api_key:
        await message.answer(
            "Голосовые команды отключены: задайте OPENAI_API_KEY в .env",
            reply_markup=admin_main_menu_kb(),
        )
        return

    status_msg = await message.answer("🎤 Слушаю…")

    try:
        audio_bytes = await asyncio.wait_for(
            _download_voice(bot, message),
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
        logger.error("Voice command timed out (download=%ss, openai=%ss)", DOWNLOAD_TIMEOUT_SEC, OPENAI_TIMEOUT_SEC)
        await _reply_or_edit(
            status_msg,
            message,
            "⏱ Таймаут OpenAI. С VPS из РФ нужен HTTPS_PROXY или OPENAI_HTTPS_PROXY в .env.\n"
            "Проверка: /voicecheck",
            reply_markup=admin_main_menu_kb(),
        )
        return
    except Exception as exc:
        logger.exception("Voice command failed")
        await _reply_or_edit(
            status_msg,
            message,
            f"Не удалось обработать голос: {exc}",
            reply_markup=admin_main_menu_kb(),
        )
        return

    if not text:
        await _reply_or_edit(
            status_msg,
            message,
            "Не расслышал текст. Попробуйте говорить дольше и чётче.",
            reply_markup=admin_main_menu_kb(),
        )
        return

    intent = str(intent_data.get("intent") or "unknown")
    await _reply_or_edit(status_msg, message, f"📝 «{text}»")

    if intent == "add_slot":
        date_s = intent_data.get("date")
        time_s = intent_data.get("time")
        if date_s and time_s:
            try:
                slot_at = parse_slot_datetime(f"{date_s} {time_s}")
                if slot_at <= datetime.now():
                    raise ValueError("Дата и время должны быть в будущем.")
                await db.add_slot(slot_at)
                await message.answer(
                    f"✅ Слот добавлен: {format_slot_datetime(slot_at)}",
                    reply_markup=admin_slots_menu_kb(),
                )
            except ValueError as exc:
                await message.answer(f"Ошибка: {exc}", reply_markup=admin_slots_menu_kb())
        else:
            await message.answer(
                "Укажите дату и время в голосовой команде или используйте меню «Слоты → Добавить».",
                reply_markup=admin_slots_menu_kb(),
            )
        return

    if intent == "list_slots":
        slots = await db.list_slots_filtered("all")
        if not slots:
            await message.answer("Слотов нет.", reply_markup=admin_slots_menu_kb())
            return
        lines = ["Будущие слоты:"] + [
            f"• {format_slot_datetime(s.slot_at)} — {s.status.label_ru}" for s in slots[:15]
        ]
        await message.answer("\n".join(lines), reply_markup=admin_slots_menu_kb())
        return

    if intent in ("list_bookings", "awaiting_payments"):
        from bot.utils import BookingStatus

        status = BookingStatus.AWAITING_PAYMENT if intent == "awaiting_payments" else None
        bookings = await db.list_bookings(status=status, future=True)
        if not bookings:
            await message.answer("Записей нет.", reply_markup=admin_main_menu_kb())
            return
        lines = ["Записи:"]
        for b in bookings[:10]:
            name = b.telegram_first_name or "—"
            lines.append(f"• {format_slot_datetime(b.slot_at)} — {name} ({b.status.label_ru})")
        await message.answer("\n".join(lines), reply_markup=admin_main_menu_kb())
        return

    if intent == "stats":
        stats = await db.get_stats()
        c = stats.counts
        await message.answer(
            f"📊 Будущих: {c.get('totalFuture', 0)}, свободно: {c.get('available', 0)}, "
            f"ожидают оплату: {c.get('awaiting_payment', 0)}",
            reply_markup=admin_main_menu_kb(),
        )
        return

    if intent == "settings":
        pricing = await db.get_pricing()
        contact = await db.get_contact_settings(
            env_phone=settings.phone,
            env_recipient=settings.recipient_name,
        )
        await message.answer(
            f"Цена {pricing.full_price} ₽, предоплата {pricing.prepay_percent}%\n"
            f"Телефон: {contact.phone}, получатель: {contact.recipient_name}",
            reply_markup=admin_main_menu_kb(),
        )
        return

    await message.answer(
        "Не понял команду. Используйте меню ⚙️ Админка или скажите, например: "
        "«добавь слот», «покажи записи», «статистика».",
        reply_markup=admin_main_menu_kb(),
    )
