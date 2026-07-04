import io
import json
import logging
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.types import Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards.admin_kb import admin_main_menu_kb, admin_slots_menu_kb
from bot.utils import format_slot_datetime, parse_slot_datetime

logger = logging.getLogger(__name__)

router = Router()


INTENT_PROMPT = """Ты парсер команд администратора фотостудии. Верни только JSON без markdown.
Поля:
- intent: one of add_slot, list_slots, list_bookings, stats, settings, awaiting_payments, unknown
- date: "ДД.ММ.ГГГГ" or null
- time: "ЧЧ:ММ" or null
- search: string or null

Примеры:
"добавь слот 25 июля в 15:00" -> {"intent":"add_slot","date":"25.07.2026","time":"15:00","search":null}
"покажи записи" -> {"intent":"list_bookings","date":null,"time":null,"search":null}
"статистика" -> {"intent":"stats","date":null,"time":null,"search":null}
"""


async def _transcribe(api_key: str, audio_bytes: bytes) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    buf = io.BytesIO(audio_bytes)
    buf.name = "voice.ogg"
    result = client.audio.transcriptions.create(model="whisper-1", file=buf, language="ru")
    return (result.text or "").strip()


async def _parse_intent(api_key: str, text: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": INTENT_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


@router.message(F.voice)
async def admin_voice(message: Message, bot: Bot, db: Database, settings: Settings) -> None:
    if not settings.openai_api_key:
        await message.answer(
            "Голосовые команды отключены: задайте OPENAI_API_KEY в .env",
            reply_markup=admin_main_menu_kb(),
        )
        return

    await message.answer("🎤 Слушаю…")
    file = await bot.get_file(message.voice.file_id)
    buf = io.BytesIO()
    await bot.download_file(file.file_path, buf)
    audio_bytes = buf.getvalue()

    try:
        text = await _transcribe(settings.openai_api_key, audio_bytes)
        intent_data = await _parse_intent(settings.openai_api_key, text)
    except Exception as exc:
        logger.exception("Voice command failed")
        await message.answer(f"Не удалось обработать голос: {exc}")
        return

    intent = str(intent_data.get("intent") or "unknown")
    await message.answer(f"📝 «{text}»")

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
