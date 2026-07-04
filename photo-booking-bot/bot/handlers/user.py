from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from bot.config import Settings
from bot.database import Database, Slot
from bot.keyboards import (
    active_booking_keyboard,
    dates_keyboard,
    payment_keyboard,
    start_keyboard,
    times_keyboard,
)
from bot.utils import DATE_BUTTON_FORMAT, SlotStatus, format_date_button, format_slot_datetime

router = Router()


class RescheduleStates(StatesGroup):
    choosing_date = State()
    choosing_time = State()


def _status_hint(status: SlotStatus) -> str:
    return {
        SlotStatus.RESERVED: "ожидает предоплаты",
        SlotStatus.AWAITING_PAYMENT: "ожидает подтверждения оплаты",
        SlotStatus.PREPAID: "предоплата подтверждена — жду вас на съёмке",
        SlotStatus.PAID_FULL: "оплачено полностью",
    }.get(status, status.label_ru)


def _booking_message(slot: Slot, pricing) -> str:
    prepay = pricing.prepay_amount
    lines = [
        f"📅 {format_slot_datetime(slot.slot_at)}",
        f"Статус: {_status_hint(slot.status)}",
    ]
    if slot.status in (SlotStatus.RESERVED, SlotStatus.AWAITING_PAYMENT):
        lines.append(f"Предоплата: {prepay} ₽ ({pricing.prepay_percent}% от {pricing.full_price} ₽)")
    return "\n".join(lines)


def _manage_keyboard(slot: Slot):
    can_manage = slot.status in (
        SlotStatus.RESERVED,
        SlotStatus.AWAITING_PAYMENT,
        SlotStatus.PREPAID,
    )
    return active_booking_keyboard(
        slot.id,
        show_pay=slot.status == SlotStatus.RESERVED,
        show_reschedule=can_manage,
        show_cancel=can_manage,
    )


@router.message(CommandStart())
async def cmd_start(message: Message, db: Database) -> None:
    active = await db.get_user_active_slot(message.from_user.id)
    text = (
        "Привет! Это Аня.\n"
        "В этом боте ты можешь записаться ко мне на фотосессию на плёночный фотоаппарат."
    )
    if active:
        text += "\n\nУ вас уже есть активная запись — нажмите «Моя запись»."
    await message.answer(text, reply_markup=start_keyboard())


@router.message(F.text == "Моя запись")
async def my_booking(message: Message, db: Database) -> None:
    slot = await db.get_user_active_slot(message.from_user.id)
    if not slot:
        await message.answer(
            "У вас пока нет активной записи. Нажмите «Записаться», чтобы выбрать время.",
            reply_markup=start_keyboard(),
        )
        return

    pricing = await db.get_pricing()
    await message.answer(
        "Ваша запись:\n\n" + _booking_message(slot, pricing),
        reply_markup=_manage_keyboard(slot),
    )


@router.message(F.text == "Записаться")
async def booking_start(message: Message, db: Database, state: FSMContext) -> None:
    await state.clear()
    active = await db.get_user_active_slot(message.from_user.id)
    if active:
        pricing = await db.get_pricing()
        await message.answer(
            "У вас уже есть запись:\n\n"
            + _booking_message(active, pricing)
            + "\n\nЧтобы выбрать другое время — перенесите или отмените текущую запись.",
            reply_markup=_manage_keyboard(active),
        )
        return

    dates = await db.list_available_dates()
    if not dates:
        await message.answer(
            "Сейчас нет свободных слотов. Загляните позже.",
            reply_markup=start_keyboard(),
        )
        return

    await message.answer(
        "Выберите дату. Фотосессия займёт один час.",
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

    if await db.get_user_active_slot(user.id):
        await callback.answer("У вас уже есть запись.", show_alert=True)
        return

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
        "Время забронировано на 15 минут — успейте внести предоплату.\n\n"
        f"{_booking_message(slot, pricing)}\n\n"
        f"Остальные {remainder}% ({pricing.full_price - prepay} ₽) — в конце фотосессии.",
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
        f"Отправьте предоплату {prepay} ₽ ({pricing.prepay_percent}%) по СБП:\n\n"
        f"{settings.phone_display}\n\n"
        f"Получатель: {settings.recipient_name}\n\n"
        "После оплаты я свяжусь с вами для подтверждения.\n\n"
        f"📅 {format_slot_datetime(slot.slot_at)}",
        reply_markup=active_booking_keyboard(
            slot.id,
            show_pay=False,
            show_reschedule=True,
            show_cancel=True,
        ),
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

    await callback.message.edit_text(
        "Запись отменена. Слот снова свободен.\n"
        "Если захотите — можно записаться заново через «Записаться»."
    )
    await callback.answer("Запись отменена")
    await callback.message.answer("Главное меню:", reply_markup=start_keyboard())


@router.callback_query(F.data.startswith("reschedule:"))
async def reschedule_start(callback: CallbackQuery, db: Database, state: FSMContext) -> None:
    slot_id = int(callback.data.removeprefix("reschedule:"))
    user = callback.from_user
    slot = await db.get_slot(slot_id)

    if not slot or slot.user_id != user.id:
        await callback.answer("Запись не найдена.", show_alert=True)
        return
    if slot.status not in (SlotStatus.RESERVED, SlotStatus.AWAITING_PAYMENT, SlotStatus.PREPAID):
        await callback.answer("Эту запись нельзя перенести.", show_alert=True)
        return

    dates = await db.list_available_dates()
    if not dates:
        await callback.answer("Нет свободных дат для переноса.", show_alert=True)
        return

    await state.set_state(RescheduleStates.choosing_date)
    await state.update_data(old_slot_id=slot_id)
    await callback.message.edit_text(
        f"Перенос записи с {format_slot_datetime(slot.slot_at)}.\n\n"
        "Выберите новую дату:",
        reply_markup=dates_keyboard(dates, prefix="rdate"),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rdate:"))
async def reschedule_choose_date(callback: CallbackQuery, db: Database, state: FSMContext) -> None:
    if await state.get_state() != RescheduleStates.choosing_date:
        await callback.answer("Сессия переноса истекла. Откройте «Моя запись».", show_alert=True)
        return

    date_str = callback.data.removeprefix("rdate:")
    try:
        selected_date = datetime.strptime(date_str, DATE_BUTTON_FORMAT)
    except ValueError:
        await callback.answer("Неверная дата.", show_alert=True)
        return

    slots = await db.list_available_times_for_date(selected_date)
    if not slots:
        await callback.answer("На эту дату нет свободного времени.", show_alert=True)
        return

    await state.set_state(RescheduleStates.choosing_time)
    await callback.message.edit_text(
        f"Выберите новое время на {format_date_button(selected_date)}:",
        reply_markup=times_keyboard(slots, prefix="rtime"),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rtime:"))
async def reschedule_choose_time(
    callback: CallbackQuery,
    db: Database,
    state: FSMContext,
    settings: Settings,
    bot: Bot,
) -> None:
    if await state.get_state() != RescheduleStates.choosing_time:
        await callback.answer("Сессия переноса истекла. Откройте «Моя запись».", show_alert=True)
        return

    data = await state.get_data()
    old_slot_id = data.get("old_slot_id")
    if not old_slot_id:
        await callback.answer("Сессия переноса истекла.", show_alert=True)
        await state.clear()
        return

    new_slot_id = int(callback.data.removeprefix("rtime:"))
    user = callback.from_user

    try:
        slot = await db.reschedule_booking(
            old_slot_id=old_slot_id,
            new_slot_id=new_slot_id,
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
        )
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    await state.clear()
    pricing = await db.get_pricing()
    await callback.message.edit_text(
        "Запись перенесена!\n\n" + _booking_message(slot, pricing),
        reply_markup=_manage_keyboard(slot),
    )
    await callback.answer("Запись перенесена")

    username_line = f"@{user.username}" if user.username else "нет username"
    admin_text = (
        "🔄 <b>Перенос записи</b>\n\n"
        f"Имя: {user.full_name}\n"
        f"Username: {username_line}\n"
        f"Telegram ID: <code>{user.id}</code>\n"
        f"Новое время: {format_slot_datetime(slot.slot_at)}\n"
        f"Статус: {slot.status.label_ru}"
    )
    await bot.send_message(settings.admin_id, admin_text, parse_mode="HTML")


@router.callback_query(F.data == "noop")
async def noop_callback(callback: CallbackQuery) -> None:
    await callback.answer()
