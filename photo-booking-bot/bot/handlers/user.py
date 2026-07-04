from datetime import datetime
from pathlib import Path

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards import dates_keyboard, payment_keyboard, start_keyboard, times_keyboard
from bot.utils import DATE_BUTTON_FORMAT, format_date_button, format_slot_datetime

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    await message.answer(
        "Привет! Это Аня.\n"
        "В этом боте ты можешь записаться ко мне на фотосессию на плёночный фотоаппарат.",
        reply_markup=start_keyboard(),
    )


@router.message(F.text == "Записаться")
async def booking_start(message: Message, db: Database) -> None:
    dates = await db.list_available_dates()
    if not dates:
        await message.answer(
            "Сейчас нет свободных слотов. Загляните позже.",
            reply_markup=start_keyboard(),
        )
        return

    await message.answer(
        "Вот свободные слоты на ближайшие дни. Фотосессия займет один час.",
        reply_markup=dates_keyboard(dates),
    )


@router.callback_query(F.data.startswith("date:"))
async def choose_date(callback: CallbackQuery, db: Database) -> None:
    date_str = callback.data.removeprefix("date:")
    try:
        selected_date = datetime.strptime(date_str, DATE_BUTTON_FORMAT)
    except ValueError:
        await callback.answer("Неверная дата.", show_alert=True)
        return

    slots = await db.list_available_times_for_date(selected_date)
    if not slots:
        await callback.answer("На эту дату нет свободного времени.", show_alert=True)
        return

    await callback.message.edit_text(
        f"Свободное время на {format_date_button(selected_date)}:",
        reply_markup=times_keyboard(slots),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("time:"))
async def choose_time(callback: CallbackQuery, db: Database) -> None:
    slot_id = int(callback.data.removeprefix("time:"))
    user = callback.from_user

    try:
        pricing = await db.get_pricing()
        slot = await db.reserve_slot(
            slot_id=slot_id,
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            prepayment_amount=pricing.prepay_amount,
            total_amount=pricing.full_price,
        )
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    prepay = pricing.prepay_amount
    remainder = 100 - pricing.prepay_percent
    await callback.message.edit_text(
        "Дата забронирована. Чтобы подтвердить запись, внесите "
        f"{pricing.prepay_percent}% предоплаты.\n"
        f"Остальные {remainder}% нужно будет внести в конце фотосессии.\n\n"
        f"Сумма предоплаты: {prepay} ₽\n"
        f"Выбрано: {format_slot_datetime(slot.slot_at)}",
        reply_markup=payment_keyboard(slot.id),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("pay:"))
async def pay_booking(
    callback: CallbackQuery,
    db: Database,
    settings: Settings,
    bot: Bot,
) -> None:
    slot_id = int(callback.data.removeprefix("pay:"))
    user = callback.from_user

    try:
        slot = await db.mark_awaiting_payment(slot_id, user.id)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    pricing = await db.get_pricing()
    prepay = pricing.prepay_amount
    await callback.message.edit_text(
        f"Отправьте {pricing.prepay_percent}% предоплаты — {prepay} ₽ — по СБП на номер:\n\n"
        f"{settings.phone_display}\n\n"
        f"Получатель: {settings.recipient_name}\n\n"
        "После оплаты я свяжусь с вами для подтверждения записи."
    )
    await callback.answer()

    username_line = f"@{user.username}" if user.username else "нет username"
    admin_text = (
        "📸 <b>Новая запись — ожидает оплату</b>\n\n"
        f"Имя: {user.full_name}\n"
        f"Username: {username_line}\n"
        f"Telegram ID: <code>{user.id}</code>\n"
        f"Дата: {slot.slot_at.strftime('%d.%m.%Y')}\n"
        f"Время: {slot.slot_at.strftime('%H:%M')}\n"
        f"Предоплата: {prepay} ₽\n"
        "Статус: Ожидает оплату"
    )
    await bot.send_message(settings.admin_id, admin_text, parse_mode="HTML")


@router.callback_query(F.data.startswith("cancel:"))
async def cancel_booking(callback: CallbackQuery, db: Database) -> None:
    slot_id = int(callback.data.removeprefix("cancel:"))
    user = callback.from_user

    try:
        await db.release_slot(slot_id, user.id)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    await callback.message.edit_text("Запись отменена.")
    await callback.answer()


@router.callback_query(F.data == "noop")
async def noop_callback(callback: CallbackQuery) -> None:
    await callback.answer()
