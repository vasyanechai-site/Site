import logging

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.channel_bind import try_bind_from_admin_message
from bot.channel_service import deliver_channel_invite, send_invite_to_user
from bot.channel_utils import SubscriptionStatus
from bot.config import Settings
from bot.database import Database
from bot.keyboards.admin_kb import admin_back_kb, admin_channel_list_kb, admin_channel_user_kb

logger = logging.getLogger(__name__)

router = Router()
logger = logging.getLogger(__name__)


@router.message(Command("bind_channel"))
async def admin_bind_channel_cmd(
    message: Message, bot: Bot, db: Database, settings: Settings
) -> None:
    reply = await try_bind_from_admin_message(message, bot, db, settings)
    if reply:
        await message.answer(reply)
        return
    await message.answer(
        "Привязка закрытого канала:\n\n"
        "Отправьте команду со ссылкой на пост:\n"
        "/bind_channel https://t.me/c/1234567890/1\n\n"
        "Или просто перешлите пост из канала / отправьте ссылку t.me/c/…"
    )


@router.message(F.text.contains("t.me") | F.caption.contains("t.me"))
async def admin_bind_channel_link(
    message: Message, bot: Bot, db: Database, settings: Settings
) -> None:
    reply = await try_bind_from_admin_message(message, bot, db, settings)
    if reply:
        await message.answer(reply)


@router.message(F.forward_date)
async def admin_bind_channel_forward(
    message: Message, bot: Bot, db: Database, settings: Settings
) -> None:
    reply = await try_bind_from_admin_message(message, bot, db, settings)
    if reply:
        await message.answer(reply)


def _stats_text(stats: dict, price: int, channel_id: int | None = None) -> str:
    ch_line = f"Канал ID: <code>{channel_id}</code>\n" if channel_id else "Канал: не привязан\n"
    return (
        "🔒 <b>Закрытый канал</b>\n\n"
        f"{ch_line}"
        f"Цена: {price} ₽/мес\n"
        f"Всего оплативших: {stats['totalPaid']}\n"
        f"Активных: {stats['active']}\n"
        f"Вступили: {stats['joined']}\n"
        f"Оплатили, не вступили: {stats['paidNotJoined']}\n"
        f"Истекло: {stats['expired']}\n"
        f"Отменено: {stats['cancelled']}\n"
        f"Новых за 7 дн.: {stats['newWeek']}\n"
        f"Выручка всего: {stats['revenueTotal']} ₽"
    )


@router.callback_query(F.data == "adm:channel:menu")
async def admin_channel_menu(callback: CallbackQuery, db: Database, settings: Settings) -> None:
    stats = await db.get_channel_stats()
    ch = await db.get_channel_settings()
    stored_id = await db.get_closed_channel_id(settings)
    channel_id = stored_id if stored_id and stored_id not in (0, -1000) else None
    await callback.message.edit_text(
        _stats_text(stats, ch.monthly_price, channel_id),
        reply_markup=admin_channel_list_kb(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "adm:channel:bind")
async def admin_channel_bind_help(callback: CallbackQuery) -> None:
    await callback.message.answer(
        "Привязка закрытого канала:\n\n"
        "Отправьте боту ссылку на пост:\n"
        "/bind_channel https://t.me/c/…/…\n\n"
        "Или перешлите пост из канала.\n"
        "Или удалите бота из админов канала и добавьте снова."
    )
    await callback.answer()


@router.callback_query(F.data == "adm:channel:list")
async def admin_channel_list(callback: CallbackQuery, db: Database) -> None:
    subs = await db.list_channel_subscriptions(limit=20)
    if not subs:
        await callback.message.edit_text(
            "Подписчиков пока нет.",
            reply_markup=admin_back_kb("adm:channel:menu"),
        )
        await callback.answer()
        return
    await callback.message.edit_text(
        "<b>Подписчики</b> — выберите пользователя:",
        reply_markup=admin_channel_list_kb(subs),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:channel:sub:"))
async def admin_channel_user(
    callback: CallbackQuery, bot: Bot, db: Database, settings: Settings
) -> None:
    sub_id = int(callback.data.split(":")[-1])
    sub = await db.get_channel_subscription_by_id(sub_id)
    invite = await db.get_latest_invite_for_subscription(sub_id)
    name = sub.telegram_first_name or "—"
    un = f"@{sub.telegram_username}" if sub.telegram_username else "—"
    inv = invite.invite_link if invite else "—"
    inv_line = f"Invite: {inv[:40]}…" if invite and len(inv) > 40 else f"Invite: {inv}"
    text = (
        f"<b>{name}</b> ({un})\n"
        f"ID: <code>{sub.telegram_user_id}</code>\n"
        f"Статус: {sub.status.label_ru}\n"
        f"Сумма: {sub.amount} ₽\n"
        f"Оплата: {sub.paid_at.strftime('%d.%m.%Y %H:%M') if sub.paid_at else '—'}\n"
        f"До: {sub.ends_at.strftime('%d.%m.%Y') if sub.ends_at else '—'}\n"
        f"Вступил: {sub.joined_at.strftime('%d.%m.%Y %H:%M') if sub.joined_at else '—'}\n"
        f"{inv_line}"
    )
    await callback.message.edit_text(
        text,
        reply_markup=admin_channel_user_kb(sub_id),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:channel:resend:"))
async def admin_resend_invite(
    callback: CallbackQuery, bot: Bot, db: Database, settings: Settings
) -> None:
    sub_id = int(callback.data.split(":")[-1])
    sub = await db.get_channel_subscription_by_id(sub_id)
    invite = await db.get_pending_invite_for_user(sub.telegram_user_id)
    if invite:
        await send_invite_to_user(bot, sub.telegram_user_id, invite.invite_link, renewed=True)
    else:
        invite = await deliver_channel_invite(bot, db, settings, sub, renewed=True)
    await callback.answer("Ссылка отправлена")


@router.callback_query(F.data.startswith("adm:channel:newinv:"))
async def admin_new_invite(
    callback: CallbackQuery, bot: Bot, db: Database, settings: Settings
) -> None:
    sub_id = int(callback.data.split(":")[-1])
    sub = await db.get_channel_subscription_by_id(sub_id)
    await deliver_channel_invite(bot, db, settings, sub, renewed=True)
    await callback.answer("Новая ссылка создана")


@router.callback_query(F.data.startswith("adm:channel:extend:"))
async def admin_extend(
    callback: CallbackQuery, db: Database,
) -> None:
    sub_id = int(callback.data.split(":")[-1])
    await db.confirm_channel_payment(sub_id, extend=True)
    await callback.answer("Подписка продлена на 30 дней")


@router.callback_query(F.data.startswith("adm:channel:cancel:"))
async def admin_cancel_sub(callback: CallbackQuery, db: Database) -> None:
    sub_id = int(callback.data.split(":")[-1])
    await db.cancel_channel_subscription(sub_id)
    await callback.answer("Подписка отменена")


@router.callback_query(F.data.startswith("adm:channel:activate:"))
async def admin_activate(callback: CallbackQuery, db: Database) -> None:
    sub_id = int(callback.data.split(":")[-1])
    await db.activate_channel_subscription_manual(sub_id)
    await callback.answer("Подписка активирована")
