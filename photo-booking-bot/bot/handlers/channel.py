from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery, Message

from bot.channel_service import (
    create_personal_invite,
    notify_admin_channel_paid,
    send_invite_to_user,
)
from bot.channel_utils import SubscriptionStatus, renewal_discounted_price
from bot.config import Settings
from bot.database import Database
from bot.keyboards.channel_kb import (
    channel_active_kb,
    channel_intro_kb,
    channel_invite_kb,
    channel_payment_kb,
)
from bot.utils import format_phone_display, now_local_dt

router = Router()


def _intro_text(price: int) -> str:
    return (
        "Закрытый канал — это пространство с дополнительными материалами, "
        "закулисьем съёмок, полезной информацией, анонсами и эксклюзивным контентом.\n\n"
        f"Стоимость доступа:\n{price} ₽ в месяц"
    )


def _payment_text(price: int, phone: str, recipient: str, *, renewal: bool = False) -> str:
    intro = (
        "Для продления доступа оплатите подписку."
        if renewal
        else "Для получения доступа оплатите подписку."
    )
    return (
        f"{intro}\n\n"
        f"Стоимость:\n{price} ₽\n\n"
        "Отправьте оплату по СБП:\n\n"
        f"Телефон:\n{format_phone_display(phone)}\n\n"
        f"Получатель:\n{recipient}\n\n"
        "После оплаты нажмите кнопку:\n«Оплачено»"
    )


async def _start_channel_payment(
    callback: CallbackQuery,
    db: Database,
    settings: Settings,
    *,
    amount: int,
    renewal: bool,
) -> None:
    user = callback.from_user
    contact = await db.get_contact_settings(
        env_phone=settings.phone,
        env_recipient=settings.recipient_name,
    )
    if renewal:
        await db.ensure_pending_renewal(
            telegram_user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            amount=amount,
        )
    else:
        await db.ensure_pending_subscription(
            telegram_user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            amount=amount,
        )
    await callback.message.edit_text(
        _payment_text(amount, contact.phone, contact.recipient_name, renewal=renewal),
        reply_markup=channel_payment_kb(),
    )
    await callback.answer()


@router.message(F.text == "Закрытый канал")
async def channel_entry(message: Message, db: Database, settings: Settings) -> None:
    user = message.from_user
    ch_settings = await db.get_channel_settings()
    sub = await db.get_user_channel_subscription(user.id)

    if sub and db.subscription_is_active(sub):
        await message.answer(
            "У вас уже есть активный доступ к закрытому каналу.",
            reply_markup=channel_active_kb(settings.closed_channel_id),
        )
        return

    pending_invite = await db.get_pending_invite_for_user(user.id)
    if sub and sub.status == SubscriptionStatus.ACTIVE and sub.paid_at and not sub.joined_at and pending_invite:
        await message.answer(
            "Оплата получена. Вступите в канал по вашей персональной ссылке:",
            reply_markup=channel_invite_kb(pending_invite.invite_link),
        )
        return

    await message.answer(
        _intro_text(ch_settings.monthly_price),
        reply_markup=channel_intro_kb(),
    )


@router.callback_query(F.data == "ch:cancel")
async def channel_cancel(callback: CallbackQuery) -> None:
    await callback.message.edit_text("Раздел «Закрытый канал» закрыт.")
    await callback.answer()


@router.callback_query(F.data == "ch:pay")
async def channel_pay(callback: CallbackQuery, db: Database, settings: Settings) -> None:
    ch_settings = await db.get_channel_settings()
    await _start_channel_payment(
        callback, db, settings, amount=ch_settings.monthly_price, renewal=False
    )


@router.callback_query(F.data == "ch:renew")
async def channel_renew(callback: CallbackQuery, db: Database, settings: Settings) -> None:
    ch_settings = await db.get_channel_settings()
    await _start_channel_payment(
        callback, db, settings, amount=ch_settings.monthly_price, renewal=True
    )


@router.callback_query(F.data == "ch:renew:disc")
async def channel_renew_discounted(
    callback: CallbackQuery, db: Database, settings: Settings
) -> None:
    user = callback.from_user
    ch_settings = await db.get_channel_settings()
    state = await db.get_channel_renewal_state(user.id)
    if db.can_offer_renewal_discount(state):
        amount = renewal_discounted_price(ch_settings.monthly_price)
    else:
        amount = ch_settings.monthly_price
    await _start_channel_payment(callback, db, settings, amount=amount, renewal=True)


@router.callback_query(F.data == "ch:paid")
async def channel_paid(callback: CallbackQuery, bot: Bot, db: Database, settings: Settings) -> None:
    user = callback.from_user
    sub = await db.get_user_channel_subscription(user.id)
    if not sub or sub.status != SubscriptionStatus.PENDING_PAYMENT:
        await callback.answer("Сначала нажмите «Оплатить».", show_alert=True)
        return

    ch_settings = await db.get_channel_settings()
    is_renewal = sub.paid_at is not None and sub.starts_at is not None
    extend = bool(
        is_renewal and sub.ends_at and sub.ends_at > now_local_dt()
    )

    sub = await db.confirm_channel_payment(sub.id, extend=extend)
    if is_renewal:
        await db.record_renewal_payment(
            user.id,
            amount=sub.amount,
            full_price=ch_settings.monthly_price,
        )

    await notify_admin_channel_paid(bot, settings, user, sub)

    if is_renewal:
        await callback.message.edit_text(
            "Спасибо! Подписка продлена.\n\n"
            f"Доступ сохранён до {sub.ends_at.strftime('%d.%m.%Y') if sub.ends_at else '—'}.",
            reply_markup=channel_active_kb(settings.closed_channel_id),
        )
        await callback.answer("Подписка продлена")
        return

    try:
        invite = await create_personal_invite(bot, db, settings, sub)
    except Exception as exc:
        await callback.message.edit_text(
            f"Оплата зафиксирована, но не удалось создать invite-ссылку: {exc}\n"
            "Напишите администратору."
        )
        await callback.answer()
        return

    await callback.message.edit_text(
        "Спасибо! Оплата зафиксирована.\n\n"
        "Персональная ссылка действует 24 часа и только для вас:",
        reply_markup=channel_invite_kb(invite.invite_link),
    )
    await send_invite_to_user(bot, user.id, invite.invite_link)
    await callback.answer("Ссылка отправлена")
