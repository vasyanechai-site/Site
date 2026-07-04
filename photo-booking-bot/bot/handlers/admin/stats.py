from aiogram import F, Router
from aiogram.types import CallbackQuery

from bot.database import Database
from bot.keyboards.admin_kb import admin_back_kb
from bot.utils import format_slot_datetime

router = Router()


@router.callback_query(F.data == "adm:stats")
async def show_stats(callback: CallbackQuery, db: Database) -> None:
    stats = await db.get_stats()
    c = stats.counts
    lines = [
        "📊 <b>Аналитика</b>",
        "",
        f"Будущих слотов: {c.get('totalFuture', 0)}",
        f"  • Свободно: {c.get('available', 0)}",
        f"  • Забронировано: {c.get('reserved', 0)}",
        f"  • Ожидает оплату: {c.get('awaiting_payment', 0)}",
        f"  • Предоплата: {c.get('prepaid', 0)}",
        f"  • Оплачено: {c.get('paid_full', 0)}",
        f"Отменённых записей: {c.get('cancelled', 0)}",
    ]
    if stats.nearest_session:
        lines.append("")
        lines.append(f"Ближайшая съёмка: {format_slot_datetime(stats.nearest_session)}")
    pricing = await db.get_pricing()
    lines.append("")
    lines.append(f"Цена: {pricing.full_price} ₽, предоплата {pricing.prepay_percent}% ({pricing.prepay_amount} ₽)")

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=admin_back_kb("adm:menu"),
        parse_mode="HTML",
    )
    await callback.answer()
