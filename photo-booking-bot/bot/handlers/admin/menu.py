from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.database import Database
from bot.keyboards import start_keyboard
from bot.keyboards.admin_kb import admin_main_menu_kb

router = Router()


@router.message(F.text == "⚙️ Админка")
@router.message(Command("admin"))
async def admin_entry(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(
        "⚙️ <b>Админ-панель</b>\n\n"
        "Управление слотами, записями и настройками.\n"
        "Голосовые команды доступны, если задан OPENAI_API_KEY.",
        reply_markup=admin_main_menu_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "adm:menu")
async def admin_main_menu(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text(
        "⚙️ <b>Админ-панель</b>",
        reply_markup=admin_main_menu_kb(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "adm:user_mode")
async def admin_back_to_user(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("Режим клиента. Используйте кнопки в меню ниже.")
    await callback.message.answer("Меню клиента:", reply_markup=start_keyboard(is_admin=True))
    await callback.answer()


@router.message(Command("dbcheck"))
async def db_check(message: Message, db: Database) -> None:
    from bot.config import load_settings

    s = load_settings()
    available = await db.count_available_future_slots()
    dates = await db.list_available_dates()
    stats = await db.get_stats()
    lines = [
        f"DB: {s.database_path}",
        f"Файл: {'есть' if s.database_path.is_file() else 'нет'}",
        f"Свободных слотов: {available}",
        f"Дат с слотами: {len(dates)}",
        f"Будущих слотов: {stats.counts.get('totalFuture', 0)}",
    ]
    if dates:
        lines.append("Даты: " + ", ".join(d.strftime("%d.%m.%Y") for d in dates[:5]))
    await message.answer("\n".join(lines))
