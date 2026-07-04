from aiogram import F, Router
from aiogram.types import CallbackQuery

from bot.database import Database
from bot.handlers.admin.helpers import format_booking_card
from bot.keyboards.admin_kb import admin_bookings_list_kb, admin_payments_menu_kb
from bot.utils import BookingStatus

router = Router()


@router.callback_query(F.data == "adm:pay:menu")
async def payments_menu(callback: CallbackQuery) -> None:
    await callback.message.edit_text("💳 <b>Оплаты</b>", reply_markup=admin_payments_menu_kb(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("adm:pay:list:"))
async def payments_list(callback: CallbackQuery, db: Database) -> None:
    status_value = callback.data.removeprefix("adm:pay:list:")
    try:
        status = BookingStatus(status_value)
    except ValueError:
        await callback.answer("Неизвестный статус", show_alert=True)
        return
    bookings = await db.list_bookings(status=status, future=True)
    labels = {
        BookingStatus.AWAITING_PAYMENT: "Ожидают оплату",
        BookingStatus.PREPAID: "Предоплата внесена",
        BookingStatus.PAID_FULL: "Оплачено полностью",
    }
    title = labels.get(status, status.label_ru)
    if not bookings:
        text = f"💳 {title}: пусто"
        await callback.message.edit_text(text, reply_markup=admin_payments_menu_kb())
    elif len(bookings) == 1:
        b = bookings[0]
        await callback.message.edit_text(
            format_booking_card(b),
            reply_markup=admin_bookings_list_kb(bookings),
            parse_mode="HTML",
        )
    else:
        text = f"💳 <b>{title}</b> ({len(bookings)})"
        await callback.message.edit_text(
            text,
            reply_markup=admin_bookings_list_kb(bookings),
            parse_mode="HTML",
        )
    await callback.answer()
