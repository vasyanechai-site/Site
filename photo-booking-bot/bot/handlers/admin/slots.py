from datetime import datetime, timedelta

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.database import Database
from bot.keyboards.admin_kb import (
    admin_cancel_kb,
    admin_dates_kb,
    admin_slot_actions_kb,
    admin_slot_list_kb,
    admin_slots_menu_kb,
    admin_times_kb,
)
from bot.states.admin_states import AddSlotStates, RescheduleSlotStates
from bot.utils import DATE_BUTTON_FORMAT, SlotStatus, format_slot_datetime, user_display_name

router = Router()


def _future_dates(days: int = 60) -> list[datetime]:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return [today + timedelta(days=i) for i in range(days)]


@router.callback_query(F.data == "adm:slot:menu")
async def slots_menu(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("📅 <b>Слоты</b>", reply_markup=admin_slots_menu_kb(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:list:"))
async def slots_list(callback: CallbackQuery, db: Database) -> None:
    list_filter = callback.data.removeprefix("adm:slot:list:")
    if list_filter not in ("all", "available", "occupied"):
        await callback.answer("Неизвестный фильтр", show_alert=True)
        return
    slots = await db.list_slots_filtered(list_filter)  # type: ignore[arg-type]
    title = {"all": "Все", "available": "Свободные", "occupied": "Занятые"}[list_filter]
    if not slots:
        text = f"📅 {title} слоты: пусто"
    else:
        lines = [f"📅 <b>{title} слоты</b> ({len(slots)}):"]
        for slot in slots[:25]:
            extra = ""
            if slot.user_id:
                name = user_display_name(slot.first_name, slot.last_name)
                extra = f" | {name}"
            lines.append(f"• {format_slot_datetime(slot.slot_at)} — {slot.status.label_ru}{extra}")
        if len(slots) > 25:
            lines.append(f"… и ещё {len(slots) - 25}")
        text = "\n".join(lines)
    await callback.message.edit_text(
        text,
        reply_markup=admin_slot_list_kb(slots, list_filter=list_filter),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:view:"))
async def slot_view(callback: CallbackQuery, db: Database) -> None:
    slot_id = int(callback.data.removeprefix("adm:slot:view:"))
    slot = await db.get_slot(slot_id)
    if not slot:
        await callback.answer("Слот не найден", show_alert=True)
        return
    extra = ""
    if slot.user_id:
        name = user_display_name(slot.first_name, slot.last_name)
        uname = f"@{slot.username}" if slot.username else "нет username"
        extra = f"\nКлиент: {name}, {uname}, id {slot.user_id}"
    text = f"🕐 {format_slot_datetime(slot.slot_at)}\nСтатус: {slot.status.label_ru}{extra}"
    can_delete = slot.status == SlotStatus.AVAILABLE
    can_reschedule = slot.status == SlotStatus.AVAILABLE
    await callback.message.edit_text(
        text,
        reply_markup=admin_slot_actions_kb(slot_id, can_delete=can_delete, can_reschedule=can_reschedule),
    )
    await callback.answer()


@router.callback_query(F.data == "adm:slot:add")
async def slot_add_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(AddSlotStates.choosing_date)
    await state.update_data(mode="add")
    dates = _future_dates()
    await callback.message.edit_text(
        "➕ Выберите дату для нового слота:",
        reply_markup=admin_dates_kb(dates, prefix="adm:slot:adddate"),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:adddate:"))
async def slot_add_date(callback: CallbackQuery, state: FSMContext) -> None:
    date_str = callback.data.removeprefix("adm:slot:adddate:")
    try:
        selected = datetime.strptime(date_str, DATE_BUTTON_FORMAT)
    except ValueError:
        await callback.answer("Неверная дата", show_alert=True)
        return
    await state.set_state(AddSlotStates.choosing_time)
    await state.update_data(selected_date=date_str, mode="add")
    slots = _hour_slots(selected)
    await callback.message.edit_text(
        f"Выберите время на {date_str}:",
        reply_markup=admin_times_kb(slots, "adm:slot:addtime", back="adm:slot:add"),
    )
    await callback.answer()


def _hour_slots(date: datetime) -> list:
    from bot.database import Slot

    slots = []
    for hour in (10, 11, 12, 13, 14, 15, 16, 17, 18, 19):
        slots.append(Slot(id=hour, slot_at=date.replace(hour=hour, minute=0), status=SlotStatus.AVAILABLE, user_id=None, username=None, first_name=None, last_name=None))
    return slots


@router.callback_query(F.data.startswith("adm:slot:addtime:"))
async def slot_add_time(callback: CallbackQuery, state: FSMContext, db: Database) -> None:
    hour = int(callback.data.removeprefix("adm:slot:addtime:"))
    data = await state.get_data()
    date_str = data.get("selected_date")
    if not date_str:
        await callback.answer("Сессия истекла", show_alert=True)
        return
    selected = datetime.strptime(date_str, DATE_BUTTON_FORMAT).replace(hour=hour, minute=0)
    if selected <= datetime.now():
        await callback.answer("Время должно быть в будущем", show_alert=True)
        return
    try:
        await db.add_slot(selected)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return
    await state.clear()
    await callback.message.edit_text(
        f"✅ Слот добавлен: {format_slot_datetime(selected)}",
        reply_markup=admin_slots_menu_kb(),
    )
    await callback.answer()


@router.callback_query(F.data == "adm:slot:bulk")
async def slot_bulk_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(AddSlotStates.bulk_lines)
    await callback.message.edit_text(
        "📦 Отправьте список слотов — каждый с новой строки.\n"
        "Формат: ДД.ММ.ГГГГ ЧЧ:ММ\n\nДля отмены — кнопка ниже или /cancel",
        reply_markup=admin_cancel_kb("adm:slot:menu"),
    )
    await callback.answer()


@router.message(AddSlotStates.bulk_lines)
async def slot_bulk_lines(message: Message, state: FSMContext, db: Database) -> None:
    added, errors = await db.parse_and_add_slots(message.text or "")
    await state.clear()
    lines = [f"Добавлено слотов: {added}"]
    if errors:
        lines.append("\nОшибки:")
        lines.extend(f"• {err}" for err in errors[:10])
    await message.answer("\n".join(lines), reply_markup=admin_slots_menu_kb())


@router.callback_query(F.data == "adm:slot:delete")
async def slot_delete_menu(callback: CallbackQuery, db: Database) -> None:
    slots = await db.list_slots_filtered("available")
    if not slots:
        await callback.answer("Нет свободных слотов", show_alert=True)
        return
    rows = [
        [{"text": format_slot_datetime(s.slot_at), "callback_data": f"adm:slot:del:{s.id}"}]
        for s in slots[:20]
    ]
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=r[0]["text"], callback_data=r[0]["callback_data"])]
            for r in rows
        ]
        + [[InlineKeyboardButton(text="← Слоты", callback_data="adm:slot:menu")]]
    )
    await callback.message.edit_text("🗑 Выберите слот для удаления:", reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:del:"))
async def slot_delete_confirm(callback: CallbackQuery, db: Database) -> None:
    slot_id = int(callback.data.removeprefix("adm:slot:del:"))
    try:
        slot = await db.get_slot(slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        label = format_slot_datetime(slot.slot_at)
        await db.delete_slot(slot_id)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return
    await callback.message.edit_text(f"Слот удалён: {label}", reply_markup=admin_slots_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "adm:slot:reschedule")
async def slot_reschedule_menu(callback: CallbackQuery, db: Database) -> None:
    slots = await db.list_slots_filtered("available")
    if not slots:
        await callback.answer("Нет свободных слотов", show_alert=True)
        return
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=format_slot_datetime(s.slot_at),
                    callback_data=f"adm:slot:move:{s.id}",
                )
            ]
            for s in slots[:20]
        ]
        + [[InlineKeyboardButton(text="← Слоты", callback_data="adm:slot:menu")]]
    )
    await callback.message.edit_text("🕐 Выберите слот для переноса:", reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:move:"))
async def slot_reschedule_start(callback: CallbackQuery, state: FSMContext) -> None:
    slot_id = int(callback.data.removeprefix("adm:slot:move:"))
    await state.set_state(RescheduleSlotStates.choosing_date)
    await state.update_data(slot_id=slot_id)
    dates = _future_dates()
    await callback.message.edit_text(
        "Выберите новую дату:",
        reply_markup=admin_dates_kb(dates, prefix=f"adm:slot:movedate:{slot_id}"),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:movedate:"))
async def slot_reschedule_date(callback: CallbackQuery, state: FSMContext) -> None:
    parts = callback.data.split(":")
    slot_id = int(parts[3])
    date_str = parts[4]
    try:
        selected = datetime.strptime(date_str, DATE_BUTTON_FORMAT)
    except ValueError:
        await callback.answer("Неверная дата", show_alert=True)
        return
    await state.set_state(RescheduleSlotStates.choosing_time)
    await state.update_data(slot_id=slot_id, selected_date=date_str)
    slots = _hour_slots(selected)
    await callback.message.edit_text(
        f"Новое время на {date_str}:",
        reply_markup=admin_times_kb(
            slots,
            f"adm:slot:movetime:{slot_id}",
            back=f"adm:slot:move:{slot_id}",
        ),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:slot:movetime:"))
async def slot_reschedule_time(callback: CallbackQuery, state: FSMContext, db: Database) -> None:
    parts = callback.data.split(":")
    slot_id = int(parts[3])
    hour = int(parts[4])
    data = await state.get_data()
    date_str = data.get("selected_date")
    if not date_str:
        await callback.answer("Сессия истекла", show_alert=True)
        return
    new_at = datetime.strptime(date_str, DATE_BUTTON_FORMAT).replace(hour=hour, minute=0)
    if new_at <= datetime.now():
        await callback.answer("Время должно быть в будущем", show_alert=True)
        return
    try:
        slot = await db.update_slot_time(slot_id, new_at)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return
    await state.clear()
    await callback.message.edit_text(
        f"✅ Слот перенесён: {format_slot_datetime(slot.slot_at)}",
        reply_markup=admin_slots_menu_kb(),
    )
    await callback.answer()
