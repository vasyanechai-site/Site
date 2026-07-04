from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.config import Settings
from bot.database import Database
from bot.keyboards.admin_kb import admin_cancel_kb, admin_settings_menu_kb
from bot.states.admin_states import EditSettingsStates
from bot.utils import format_phone_display

router = Router()


async def _settings_text(db: Database, settings: Settings) -> str:
    pricing = await db.get_pricing()
    contact = await db.get_contact_settings(
        env_phone=settings.phone,
        env_recipient=settings.recipient_name,
    )
    return (
        "⚙️ <b>Настройки</b>\n\n"
        f"💰 Полная стоимость: {pricing.full_price} ₽\n"
        f"📊 Предоплата: {pricing.prepay_percent}% ({pricing.prepay_amount} ₽)\n"
        f"📞 Телефон СБП: {format_phone_display(contact.phone)}\n"
        f"👤 Получатель: {contact.recipient_name}"
    )


@router.callback_query(F.data == "adm:settings:menu")
async def settings_menu(callback: CallbackQuery, state: FSMContext, db: Database, settings: Settings) -> None:
    await state.clear()
    await callback.message.edit_text(
        await _settings_text(db, settings),
        reply_markup=admin_settings_menu_kb(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "adm:settings:price")
async def settings_price_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(EditSettingsStates.waiting_price)
    await callback.message.edit_text(
        "💰 Введите полную стоимость съёмки (₽, целое число):",
        reply_markup=admin_cancel_kb("adm:settings:menu"),
    )
    await callback.answer()


@router.message(EditSettingsStates.waiting_price)
async def settings_price_save(message: Message, state: FSMContext, db: Database, settings: Settings) -> None:
    try:
        price = int((message.text or "").strip())
        pricing = await db.get_pricing()
        await db.update_pricing(price, pricing.prepay_percent)
    except ValueError as exc:
        await message.answer(f"Ошибка: {exc}")
        return
    await state.clear()
    await message.answer(
        await _settings_text(db, settings),
        reply_markup=admin_settings_menu_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "adm:settings:prepay")
async def settings_prepay_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(EditSettingsStates.waiting_prepay)
    await callback.message.edit_text(
        "📊 Введите процент предоплаты (1–99):",
        reply_markup=admin_cancel_kb("adm:settings:menu"),
    )
    await callback.answer()


@router.message(EditSettingsStates.waiting_prepay)
async def settings_prepay_save(message: Message, state: FSMContext, db: Database, settings: Settings) -> None:
    try:
        prepay = int((message.text or "").strip())
        pricing = await db.get_pricing()
        await db.update_pricing(pricing.full_price, prepay)
    except ValueError as exc:
        await message.answer(f"Ошибка: {exc}")
        return
    await state.clear()
    await message.answer(
        await _settings_text(db, settings),
        reply_markup=admin_settings_menu_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "adm:settings:phone")
async def settings_phone_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(EditSettingsStates.waiting_phone)
    await callback.message.edit_text(
        "📞 Введите номер телефона для СБП:",
        reply_markup=admin_cancel_kb("adm:settings:menu"),
    )
    await callback.answer()


@router.message(EditSettingsStates.waiting_phone)
async def settings_phone_save(message: Message, state: FSMContext, db: Database, settings: Settings) -> None:
    phone = (message.text or "").strip()
    if not phone:
        await message.answer("Номер не может быть пустым")
        return
    await db.update_contact_settings(phone=phone)
    await state.clear()
    await message.answer(
        await _settings_text(db, settings),
        reply_markup=admin_settings_menu_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "adm:settings:recipient")
async def settings_recipient_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(EditSettingsStates.waiting_recipient)
    await callback.message.edit_text(
        "👤 Введите имя получателя платежа:",
        reply_markup=admin_cancel_kb("adm:settings:menu"),
    )
    await callback.answer()


@router.message(EditSettingsStates.waiting_recipient)
async def settings_recipient_save(message: Message, state: FSMContext, db: Database, settings: Settings) -> None:
    name = (message.text or "").strip()
    if not name:
        await message.answer("Имя не может быть пустым")
        return
    await db.update_contact_settings(recipient_name=name)
    await state.clear()
    await message.answer(
        await _settings_text(db, settings),
        reply_markup=admin_settings_menu_kb(),
        parse_mode="HTML",
    )
