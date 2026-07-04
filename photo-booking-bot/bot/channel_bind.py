"""Bind closed channel id from admin messages."""

from __future__ import annotations

import re

from aiogram import Bot
from aiogram.enums import ChatType
from aiogram.types import Message
from aiogram.types import MessageOriginChannel

from bot.channel_setup import channel_id_env_hint, inspect_closed_channel
from bot.channel_utils import parse_channel_id_from_text
from bot.config import Settings
from bot.database import Database

_TME_URL = re.compile(r"(?:https?://)?t\.me/\S+", re.IGNORECASE)


def _message_text_blob(message: Message) -> str:
    chunks = [message.text or "", message.caption or ""]
    for entity_list, text in (
        (message.entities, message.text),
        (message.caption_entities, message.caption),
    ):
        if not entity_list or not text:
            continue
        for ent in entity_list:
            if ent.type in ("url", "text_link"):
                chunks.append(text[ent.offset : ent.offset + ent.length])
    return "\n".join(chunks)


def _channel_id_from_forward(message: Message) -> tuple[int | None, str | None]:
    origin = message.forward_origin
    if isinstance(origin, MessageOriginChannel):
        return origin.chat.id, origin.chat.title
    if message.forward_from_chat and message.forward_from_chat.type == ChatType.CHANNEL:
        return message.forward_from_chat.id, message.forward_from_chat.title
    return None, None


async def bind_closed_channel(
    bot: Bot,
    db: Database,
    settings: Settings,
    chat_id: int,
    *,
    title: str | None = None,
) -> str:
    await db.set_closed_channel_telegram_id(chat_id)
    info = await inspect_closed_channel(bot, chat_id)
    env_value = channel_id_env_hint(chat_id)
    if info.get("ok"):
        title_line = f"Название: {title}\n" if title else ""
        return (
            "Закрытый канал привязан.\n\n"
            f"{title_line}"
            f"ID: {chat_id}\n\n"
            "Invite-ссылки должны работать. Пользователям с оплатой — «Закрытый канал»."
        )
    return (
        "ID канала сохранён, но проверка не прошла.\n\n"
        f"Channel ID: {chat_id}\n"
        f"Ошибка: {info.get('error', 'неизвестно')}\n\n"
        "Проверьте право бота «приглашать пользователей по ссылке»."
    )


async def try_bind_from_admin_message(
    message: Message,
    bot: Bot,
    db: Database,
    settings: Settings,
) -> str | None:
    """Return reply text if this message is a channel bind attempt, else None."""
    blob = _message_text_blob(message)
    chat_id = None
    title = None

    for url in _TME_URL.findall(blob):
        chat_id = parse_channel_id_from_text(url)
        if chat_id is not None:
            break

    if chat_id is None:
        chat_id, title = _channel_id_from_forward(message)

    if chat_id is None:
        if "t.me" in blob.lower() or message.forward_date:
            return (
                "Не удалось определить канал из этого сообщения.\n\n"
                "Отправьте ссылку на пост в формате:\n"
                "https://t.me/c/1234567890/1\n\n"
                "Или перешлите пост из канала (не «Поделиться», а «Переслать»).\n"
                "Команда: /bind_channel https://t.me/c/…"
            )
        return None

    return await bind_closed_channel(bot, db, settings, chat_id, title=title)
