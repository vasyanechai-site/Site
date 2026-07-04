"""Expiry reminders and renewal discount eligibility."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from aiogram import Bot

from bot.channel_utils import (
    RENEWAL_FEEDBACK_USERNAME,
    REMINDER_24H_HOURS,
    REMINDER_48H_HOURS,
    renewal_discounted_price,
)
from bot.config import Settings
from bot.database import Database
from bot.keyboards.channel_kb import channel_renew_24h_kb, channel_renew_48h_kb
from bot.utils import now_local_dt

logger = logging.getLogger(__name__)


def message_48h(full_price: int, ends_at: datetime) -> str:
    date_label = ends_at.strftime("%d.%m.%Y")
    return (
        "Через 48 часов заканчивается ваш доступ к закрытому каналу "
        f"(до {date_label}).\n\n"
        "Если хотите продолжить смотреть материалы, закулисье и анонсы, "
        "можно продлить подписку сейчас — доступ сохранится без перерыва.\n\n"
        f"Стоимость продления: {full_price} ₽ на месяц."
    )


def message_24h_with_discount(full_price: int, discounted: int) -> str:
    return (
        "Доступ к закрытому каналу скоро закончится — вижу, что вы ещё не продлили подписку.\n\n"
        "Буду рада услышать, если что-то не понравилось или мешало остаться. "
        f"Напишите напрямую: @{RENEWAL_FEEDBACK_USERNAME}\n\n"
        f"Для вас — скидка 50% на продление на один месяц: {discounted} ₽ "
        f"вместо {full_price} ₽."
    )


def message_24h_full_price(full_price: int) -> str:
    return (
        "Доступ к закрытому каналу скоро закончится — вижу, что вы ещё не продлили подписку.\n\n"
        "Буду рада услышать, если что-то не понравилось или мешало остаться. "
        f"Напишите напрямую: @{RENEWAL_FEEDBACK_USERNAME}\n\n"
        f"Продлить подписку можно по обычной стоимости: {full_price} ₽ на месяц."
    )


async def process_renewal_reminders(bot: Bot, db: Database, settings: Settings) -> None:
    await db.expire_channel_subscriptions()
    ch = await db.get_channel_settings()
    now = now_local_dt()

    for sub in await db.list_subscriptions_for_reminders():
        if await db.user_has_pending_channel_payment(sub.telegram_user_id):
            continue
        if not sub.ends_at or sub.ends_at <= now:
            continue

        hours_left = (sub.ends_at - now).total_seconds() / 3600

        if (
            hours_left <= REMINDER_48H_HOURS
            and hours_left > REMINDER_24H_HOURS
            and not sub.reminder_48h_sent_at
        ):
            try:
                await bot.send_message(
                    sub.telegram_user_id,
                    message_48h(ch.monthly_price, sub.ends_at),
                    reply_markup=channel_renew_48h_kb(),
                )
                await db.mark_reminder_sent(sub.id, kind="48h")
            except Exception:
                logger.exception("48h reminder failed for user %s", sub.telegram_user_id)
            continue

        if hours_left <= REMINDER_24H_HOURS and hours_left > 0 and not sub.reminder_24h_sent_at:
            state = await db.get_channel_renewal_state(sub.telegram_user_id)
            offer_discount = db.can_offer_renewal_discount(state)
            if offer_discount:
                discounted = renewal_discounted_price(ch.monthly_price)
                text = message_24h_with_discount(ch.monthly_price, discounted)
                kb = channel_renew_24h_kb(discount=True)
            else:
                text = message_24h_full_price(ch.monthly_price)
                kb = channel_renew_24h_kb(discount=False)
            try:
                await bot.send_message(sub.telegram_user_id, text, reply_markup=kb)
                await db.mark_reminder_sent(sub.id, kind="24h")
            except Exception:
                logger.exception("24h reminder failed for user %s", sub.telegram_user_id)


async def renewal_reminder_loop(bot: Bot, db: Database, settings: Settings) -> None:
    while True:
        try:
            await process_renewal_reminders(bot, db, settings)
        except Exception:
            logger.exception("renewal reminder loop error")
        await asyncio.sleep(3600)
