from datetime import datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards import delete_slots_keyboard
from bot.utils import format_slot_datetime, parse_slot_datetime, user_display_name

router = Router()


class AddSlotsState(StatesGroup):
    waiting_for_lines = State()


def admin_only_message(message: Message, settings: Settings) -> bool:
    if message.from_user and message.from_user.id == settings.admin_id:
        return True
    return False


@router.message(Command("addslot"))
async def add_slot(message: Message, db: Database, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await message.answer("Эта команда доступна только администратору.")
        return

    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("Формат: /addslot ДД.ММ.ГГГГ ЧЧ:ММ\nПример: /addslot 23.07.2026 17:00")
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
async def add_slots_start(message: Message, state: FSMContext, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await message.answer("Эта команда доступна только администратору.")
        return

    await state.set_state(AddSlotsState.waiting_for_lines)
    await message.answer(
        "Отправьте список слотов — каждый с новой строки.\n"
        "Формат: ДД.ММ.ГГГГ ЧЧ:ММ\n\n"
        "Пример:\n"
        "23.07.2026 17:00\n"
        "23.07.2026 19:00\n"
        "24.07.2026 18:00\n\n"
        "Для отмены отправьте /cancel"
    )


@router.message(Command("cancel"))
async def cancel_state(message: Message, state: FSMContext, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        return
    current = await state.get_state()
    if current == AddSlotsState.waiting_for_lines.state:
        await state.clear()
        await message.answer("Добавление слотов отменено.")


@router.message(AddSlotsState.waiting_for_lines)
async def add_slots_lines(message: Message, state: FSMContext, db: Database, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await state.clear()
        return

    added, errors = await db.parse_and_add_slots(message.text or "")
    await state.clear()

    lines = [f"Добавлено слотов: {added}"]
    if errors:
        lines.append("\nОшибки:")
        lines.extend(f"• {err}" for err in errors)
    await message.answer("\n".join(lines))


@router.message(Command("listslots"))
async def list_slots(message: Message, db: Database, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await message.answer("Эта команда доступна только администратору.")
        return

    slots = await db.list_future_slots()
    if not slots:
        await message.answer("Будущих слотов пока нет.")
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
    await message.answer("\n".join(lines))


@router.message(Command("deleteslot"))
async def delete_slot_menu(message: Message, db: Database, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await message.answer("Эта команда доступна только администратору.")
        return

    slots = await db.list_future_slots()
    available = [slot for slot in slots if slot.status.value == "available"]
    await message.answer(
        "Выберите свободный слот для удаления:",
        reply_markup=delete_slots_keyboard(available),
    )


@router.callback_query(F.data.startswith("delslot:"))
async def delete_slot_confirm(callback: CallbackQuery, db: Database, settings: Settings) -> None:
    if callback.from_user.id != settings.admin_id:
        await callback.answer("Только для администратора.", show_alert=True)
        return

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
async def list_bookings(message: Message, db: Database, settings: Settings) -> None:
    if not admin_only_message(message, settings):
        await message.answer("Эта команда доступна только администратору.")
        return

    bookings = await db.list_awaiting_payment()
    if not bookings:
        await message.answer("Пока никто не дошёл до этапа оплаты.")
        return

    lines = ["Записи, ожидающие оплату:"]
    for slot in bookings:
        username = f"@{slot.username}" if slot.username else "нет username"
        name = user_display_name(slot.first_name, slot.last_name)
        lines.append(
            f"• {format_slot_datetime(slot.slot_at)}\n"
            f"  {name} | {username} | id {slot.user_id}"
        )
    await message.answer("\n\n".join(lines))
