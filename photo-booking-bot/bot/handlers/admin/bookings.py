from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.database import Database
from bot.handlers.admin.helpers import format_booking_card
from bot.keyboards.admin_kb import admin_booking_card_kb, admin_bookings_list_kb, admin_bookings_menu_kb
from bot.states.admin_states import BookingCommentStates, BookingSearchStates
from bot.utils import BookingStatus

router = Router()


@router.callback_query(F.data == "adm:book:menu")
async def bookings_menu(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("📋 <b>Записи</b>", reply_markup=admin_bookings_menu_kb(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("adm:book:list:"))
async def bookings_list(callback: CallbackQuery, db: Database) -> None:
    mode = callback.data.removeprefix("adm:book:list:")
    kwargs: dict = {}
    title = "Все записи"
    if mode == "future":
        kwargs["future"] = True
        title = "Будущие записи"
    elif mode == "past":
        kwargs["past"] = True
        title = "Прошлые записи"
    bookings = await db.list_bookings(**kwargs)
    active = [b for b in bookings if b.status != BookingStatus.CANCELLED]
    if not active:
        text = f"📋 {title}: пусто"
    else:
        text = f"📋 <b>{title}</b> ({len(active)}):"
    await callback.message.edit_text(
        text,
        reply_markup=admin_bookings_list_kb(active),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "adm:book:search")
async def bookings_search_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(BookingSearchStates.waiting_query)
    await callback.message.edit_text(
        "🔍 Введите имя, username или Telegram ID:",
    )
    await callback.answer()


@router.message(BookingSearchStates.waiting_query)
async def bookings_search_query(message: Message, state: FSMContext, db: Database) -> None:
    query = (message.text or "").strip()
    await state.clear()
    bookings = await db.list_bookings(search=query)
    active = [b for b in bookings if b.status != BookingStatus.CANCELLED]
    text = f"🔍 Результаты «{query}»: {len(active)}"
    await message.answer(text, reply_markup=admin_bookings_list_kb(active))


@router.callback_query(F.data.startswith("adm:book:view:"))
async def booking_view(callback: CallbackQuery, db: Database) -> None:
    booking_id = int(callback.data.removeprefix("adm:book:view:"))
    booking = await db.get_booking(booking_id)
    if not booking:
        await callback.answer("Запись не найдена", show_alert=True)
        return
    await callback.message.edit_text(
        format_booking_card(booking),
        reply_markup=admin_booking_card_kb(booking_id, booking.status),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:book:status:"))
async def booking_change_status(callback: CallbackQuery, db: Database) -> None:
    parts = callback.data.split(":")
    booking_id = int(parts[3])
    new_status = BookingStatus(parts[4])
    try:
        booking = await db.update_booking(booking_id, status=new_status)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return
    await callback.message.edit_text(
        format_booking_card(booking),
        reply_markup=admin_booking_card_kb(booking_id, booking.status),
        parse_mode="HTML",
    )
    await callback.answer(f"Статус: {booking.status.label_ru}")


@router.callback_query(F.data.startswith("adm:book:comment:"))
async def booking_comment_start(callback: CallbackQuery, state: FSMContext) -> None:
    booking_id = int(callback.data.removeprefix("adm:book:comment:"))
    await state.set_state(BookingCommentStates.waiting_comment)
    await state.update_data(booking_id=booking_id)
    await callback.message.edit_text("💬 Введите комментарий администратора:")
    await callback.answer()


@router.message(BookingCommentStates.waiting_comment)
async def booking_comment_save(message: Message, state: FSMContext, db: Database) -> None:
    data = await state.get_data()
    booking_id = data.get("booking_id")
    if not booking_id:
        await state.clear()
        await message.answer("Сессия истекла")
        return
    comment = (message.text or "").strip()
    try:
        booking = await db.update_booking(int(booking_id), admin_comment=comment)
    except ValueError as exc:
        await message.answer(str(exc))
        return
    await state.clear()
    await message.answer(
        format_booking_card(booking),
        reply_markup=admin_booking_card_kb(booking.id, booking.status),
        parse_mode="HTML",
    )
