"""Startup checks and admin hints for closed channel configuration."""

from __future__ import annotations

import logging

from aiogram import Bot
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError

from bot.config import Settings

logger = logging.getLogger(__name__)


def channel_id_env_hint(chat_id: int) -> str:
    """Value to store in CLOSED_CHANNEL_ID (GitHub secret / .env)."""
    s = str(chat_id)
    if s.startswith("-100"):
        return s[4:]
    if s.startswith("-"):
        return s[1:]
    return s


async def inspect_closed_channel(bot: Bot, settings: Settings) -> dict:
    """Return diagnostics for configured closed channel."""
    chat_id = settings.closed_channel_id
    result = {"configured_id": chat_id, "ok": False}
    try:
        chat = await bot.get_chat(chat_id)
    except TelegramBadRequest as exc:
        result["error"] = exc.message
        return result
    except Exception as exc:
        result["error"] = str(exc)
        return result

    result["chat_id"] = chat.id
    result["type"] = chat.type
    result["title"] = getattr(chat, "title", None)
    if chat.type not in (ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP):
        result["error"] = f"ожидался канал, получен тип {chat.type!r}"
        return result

    me = await bot.get_me()
    try:
        member = await bot.get_chat_member(chat.id, me.id)
        result["bot_status"] = member.status
        result["can_invite_users"] = getattr(member, "can_invite_users", None)
    except Exception as exc:
        result["error"] = f"бот не в канале или нет доступа: {exc}"
        return result

    if not getattr(member, "can_invite_users", False):
        result["error"] = "у бота нет права «приглашать пользователей по ссылке»"
        return result

    try:
        link = await bot.create_chat_invite_link(
            chat_id=chat.id,
            member_limit=1,
            name="healthcheck",
        )
        await bot.revoke_chat_invite_link(chat.id, link.invite_link)
        result["ok"] = True
    except TelegramForbiddenError as exc:
        result["error"] = exc.message
    except TelegramBadRequest as exc:
        result["error"] = exc.message
    except Exception as exc:
        result["error"] = str(exc)
    return result


async def notify_admins_channel_misconfigured(bot: Bot, settings: Settings, info: dict) -> None:
    hint = channel_id_env_hint(info["chat_id"]) if info.get("chat_id") else "?"
    text = (
        "Закрытый канал настроен неверно.\n\n"
        f"CLOSED_CHANNEL_ID сейчас: {info.get('configured_id')}\n"
        f"Проблема: {info.get('error', 'неизвестно')}\n\n"
        "Что сделать:\n"
        "1. Добавьте бота @AnnaNechaiBot администратором в закрытый канал\n"
        "2. Включите право «приглашать пользователей по ссылке»\n"
        "3. Бот пришлёт ID канала после добавления — укажите его в GitHub Secret CLOSED_CHANNEL_ID\n"
        f"   (формат числа из t.me/c/… или id канала: {hint})"
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception:
            logger.exception("Failed to notify admin %s about channel config", admin_id)


async def validate_closed_channel_on_startup(bot: Bot, settings: Settings) -> None:
    info = await inspect_closed_channel(bot, settings)
    if info.get("ok"):
        logger.info(
            "Closed channel OK: %s (%s, id=%s)",
            info.get("title"),
            info.get("type"),
            info.get("chat_id"),
        )
        return
    logger.error(
        "Closed channel misconfigured: id=%s error=%s",
        info.get("configured_id"),
        info.get("error"),
    )
    await notify_admins_channel_misconfigured(bot, settings, info)
