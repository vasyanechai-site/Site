"""Legacy slash-команды администратора (совместимость)."""

from datetime import datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards import delete_slots_keyboard
from bot.keyboards.admin_kb import admin_main_menu_kb, admin_slots_menu_kb
from bot.states import AddSlotsState
from bot.utils import format_slot_datetime, parse_slot_datetime, user_display_name

router = Router()


@router.message(Command("addslot"))
async def add_slot(message: Message, db: Database) -> None:
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await message.answer(
            "Формат: /addslot ДД.ММ.ГГГГ ЧЧ:ММ\n"
            "Или откройте ⚙️ Админка → Слоты → Добавить.",
            reply_markup=admin_slots_menu_kb(),
        )
        return

    try:
        slot_at = parse_slot_datetime(parts[1])
        if slot_at <= datetime.now():
            raise ValueError("Дата и время должны быть в будущем.")
        await db.add_slot(slot_at)
    except ValueError as exc:
        await message.answer(f"Ошибка: {exc}")
        return

    await message.answer(f"Слот добавлен: {format_slot_datetime(slot_at)}")


@router.message(Command("addslots"))
async def add_slots_start(message: Message, state: FSMContext) -> None:
    await state.set_state(AddSlotsState.waiting_for_lines)
    await message.answer(
        "Отправьте список слотов — каждый с новой строки.\n"
        "Формат: ДД.ММ.ГГГГ ЧЧ:ММ\n\n"
        "Для отмены отправьте /cancel\n"
        "Или: ⚙️ Админка → Слоты → Пакетом.",
        reply_markup=admin_slots_menu_kb(),
    )


@router.message(AddSlotsState.waiting_for_lines)
async def add_slots_lines(message: Message, state: FSMContext, db: Database) -> None:
    added, errors = await db.parse_and_add_slots(message.text or "")
    await state.clear()

    lines = [f"Добавлено слотов: {added}"]
    if errors:
        lines.append("\nОшибки:")
        lines.extend(f"• {err}" for err in errors)
    await message.answer("\n".join(lines))


@router.message(Command("listslots"))
async def list_slots(message: Message, db: Database) -> None:
    slots = await db.list_future_slots()
    if not slots:
        await message.answer("Будущих слотов пока нет.", reply_markup=admin_slots_menu_kb())
        return

    lines = ["Будущие слоты:"]
    for slot in slots:
        user_part = ""
        if slot.user_id:
            username = f"@{slot.username}" if slot.username else "без username"
            name = user_display_name(slot.first_name, slot.last_name)
            user_part = f" | {name}, {username}, id {slot.user_id}"
        lines.append(
            f"• {format_slot_datetime(slot.slot_at)} — {slot.status.label_ru}{user_part}"
        )
    await message.answer("\n".join(lines), reply_markup=admin_slots_menu_kb())


@router.message(Command("deleteslot"))
async def delete_slot_menu(message: Message, db: Database) -> None:
    slots = await db.list_future_slots()
    available = [slot for slot in slots if slot.status.value == "available"]
    await message.answer(
        "Выберите свободный слот для удаления:",
        reply_markup=delete_slots_keyboard(available),
    )


@router.callback_query(F.data.startswith("delslot:"))
async def delete_slot_confirm(callback: CallbackQuery, db: Database) -> None:
    slot_id = int(callback.data.removeprefix("delslot:"))
    try:
        slot = await db.get_slot(slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        label = format_slot_datetime(slot.slot_at)
        await db.delete_slot(slot_id)
    except ValueError as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    await callback.message.edit_text(f"Слот удалён: {label}")
    await callback.answer()


@router.message(Command("bookings"))
async def list_bookings(message: Message, db: Database) -> None:
    bookings = await db.list_awaiting_payment()
    if not bookings:
        await message.answer(
            "Пока никто не дошёл до этапа оплаты.",
            reply_markup=admin_main_menu_kb(),
        )
        return

    lines = ["Записи, ожидающие оплату:"]
    for slot in bookings:
        username = f"@{slot.username}" if slot.username else "нет username"
        name = user_display_name(slot.first_name, slot.last_name)
        lines.append(
            f"• {format_slot_datetime(slot.slot_at)}\n"
            f"  {name} | {username} | id {slot.user_id}"
        )
    await message.answer("\n\n".join(lines), reply_markup=admin_main_menu_kb())
