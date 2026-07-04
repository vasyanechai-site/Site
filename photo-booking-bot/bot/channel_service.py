"""Telegram channel invite link service."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from aiogram import Bot
from aiogram.types import User

from bot.channel_db import ChannelInviteLink, ChannelSubscription
from bot.channel_utils import INVITE_EXPIRE_HOURS, channel_open_url
from bot.config import Settings
from bot.database import Database

logger = logging.getLogger(__name__)


async def create_personal_invite(
    bot: Bot,
    db: Database,
    settings: Settings,
    subscription: ChannelSubscription,
) -> ChannelInviteLink:
    expires_at = datetime.now() + timedelta(hours=INVITE_EXPIRE_HOURS)
    expire_ts = int(expires_at.timestamp())
    link = await bot.create_chat_invite_link(
        chat_id=settings.closed_channel_id,
        member_limit=1,
        expire_date=expire_ts,
        name=f"sub{subscription.id}_u{subscription.telegram_user_id}",
    )
    return await db.save_invite_link(
        subscription_id=subscription.id,
        telegram_user_id=subscription.telegram_user_id,
        invite_link=link.invite_link,
        expected_user_id=subscription.telegram_user_id,
        expires_at=expires_at,
    )


async def issue_channel_invite(
    bot: Bot,
    db: Database,
    settings: Settings,
    subscription: ChannelSubscription,
) -> ChannelInviteLink:
    pending = await db.get_pending_invite_for_user(subscription.telegram_user_id)
    if pending and pending.subscription_id == subscription.id:
        return pending
    return await create_personal_invite(bot, db, settings, subscription)


async def deliver_channel_invite(
    bot: Bot,
    db: Database,
    settings: Settings,
    subscription: ChannelSubscription,
    *,
    renewed: bool = False,
) -> ChannelInviteLink:
    invite = await issue_channel_invite(bot, db, settings, subscription)
    try:
        await send_invite_to_user(
            bot,
            subscription.telegram_user_id,
            invite.invite_link,
            renewed=renewed,
        )
    except Exception:
        logger.exception(
            "Failed to send invite DM to user %s (link still in inline button)",
            subscription.telegram_user_id,
        )
    return invite


async def send_invite_to_user(
    bot: Bot,
    user_id: int,
    invite_url: str,
    *,
    renewed: bool = False,
) -> None:
    prefix = "Новая ссылка для входа" if renewed else "Ваша персональная ссылка"
    await bot.send_message(
        user_id,
        f"{prefix} (действует 24 часа, только для вас):\n\n{invite_url}",
    )


async def notify_admin_channel_paid(
    bot: Bot,
    settings: Settings,
    user: User,
    subscription: ChannelSubscription,
) -> None:
    username = f"@{user.username}" if user.username else "нет username"
    text = (
        "🔒 <b>Оплата закрытого канала</b>\n\n"
        f"Имя: {user.full_name}\n"
        f"Username: {username}\n"
        f"Telegram ID: <code>{user.id}</code>\n"
        f"Сумма: {subscription.amount} ₽\n"
        f"Статус: {subscription.status.label_ru}\n"
        f"Оплачено: {subscription.paid_at.strftime('%d.%m.%Y %H:%M') if subscription.paid_at else '—'}"
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            logger.exception("Failed to notify admin %s about channel payment", admin_id)


async def notify_admin_wrong_join(
    bot: Bot,
    settings: Settings,
    *,
    expected_user_id: int,
    actual_user_id: int,
    invite_link: str,
) -> None:
    text = (
        "⚠️ <b>Чужой вход по invite-ссылке канала</b>\n\n"
        f"Ожидался ID: <code>{expected_user_id}</code>\n"
        f"Вступил ID: <code>{actual_user_id}</code>\n"
        f"Ссылка: {invite_link}"
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            logger.exception("Failed to notify admin %s about wrong join", admin_id)


async def kick_from_channel(bot: Bot, settings: Settings, user_id: int) -> bool:
    try:
        await bot.ban_chat_member(settings.closed_channel_id, user_id)
        await bot.unban_chat_member(settings.closed_channel_id, user_id)
        return True
    except Exception as exc:
        logger.warning("Could not remove user %s from channel: %s", user_id, exc)
        return False


async def handle_channel_join(
    bot: Bot,
    db: Database,
    settings: Settings,
    *,
    user_id: int,
    invite_url: str | None,
) -> None:
    if not invite_url:
        return
    record = await db.get_invite_by_url(invite_url)
    if not record or record.status.value != "pending":
        return

    if user_id == record.expected_user_id:
        await db.mark_invite_used(record.id, used_by_user_id=user_id, ok=True)
        await bot.send_message(
            user_id,
            f"Добро пожаловать в закрытый канал!\n\nОткрыть: {channel_open_url(settings.closed_channel_id)}",
        )
        return

    await db.mark_invite_used(record.id, used_by_user_id=user_id, ok=False)
    await notify_admin_wrong_join(
        bot,
        settings,
        expected_user_id=record.expected_user_id,
        actual_user_id=user_id,
        invite_link=invite_url,
    )
    await kick_from_channel(bot, settings, user_id)
    try:
        new_invite = await create_personal_invite(
            bot,
            db,
            settings,
            await db.get_channel_subscription_by_id(record.subscription_id),
        )
        await send_invite_to_user(
            bot,
            record.expected_user_id,
            new_invite.invite_link,
            renewed=True,
        )
    except Exception:
        logger.exception("Failed to regenerate invite for user %s", record.expected_user_id)
