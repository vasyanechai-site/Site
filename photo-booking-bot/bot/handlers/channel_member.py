import logging

from aiogram import F, Router
from aiogram.enums import ChatType
from aiogram.filters import ChatMemberUpdatedFilter, IS_MEMBER, IS_NOT_MEMBER
from aiogram.types import ChatMemberUpdated, Message
from aiogram.types import MessageOriginChannel

from bot.channel_utils import parse_channel_id_from_text
from bot.channel_service import handle_channel_join
from bot.channel_setup import channel_id_env_hint, inspect_closed_channel
from bot.config import Settings
from bot.database import Database

logger = logging.getLogger(__name__)

router = Router()


async def _bind_closed_channel(
    bot,
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
        return (
            "Закрытый канал привязан.\n\n"
            f"{'Название: ' + title if title else ''}\n"
            f"ID: {chat_id}\n"
            f"CLOSED_CHANNEL_ID (если нужен в GitHub): {env_value}\n\n"
            "Invite-ссылки теперь должны работать. "
            "Пользователям с оплатой — «Закрытый канал» в боте."
        ).replace("\n\n\n", "\n\n")
    return (
        "ID канала сохранён, но проверка не прошла.\n\n"
        f"Channel ID: {chat_id}\n"
        f"Ошибка: {info.get('error', 'неизвестно')}\n\n"
        "Убедитесь, что у бота есть право «приглашать пользователей по ссылке»."
    )


@router.my_chat_member()
async def on_bot_added_to_channel(
    event: ChatMemberUpdated,
    bot,
    db: Database,
    settings: Settings,
) -> None:
    chat = event.chat
    if chat.type != ChatType.CHANNEL:
        return
    status = event.new_chat_member.status
    if status not in ("administrator", "creator"):
        return
    text = await _bind_closed_channel(bot, db, settings, chat.id, title=chat.title)
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception:
            logger.exception("Failed to send channel bind notice to admin %s", admin_id)


@router.message(F.chat.type == ChatType.PRIVATE)
async def admin_bind_channel_from_forward(
    message: Message,
    bot,
    db: Database,
    settings: Settings,
) -> None:
    if message.from_user.id not in settings.admin_ids:
        return

    chat_id = parse_channel_id_from_text(message.text or "")
    title = None
    if chat_id is None:
        origin = message.forward_origin
        if isinstance(origin, MessageOriginChannel):
            chat_id = origin.chat.id
            title = origin.chat.title
        elif message.forward_from_chat and message.forward_from_chat.type == ChatType.CHANNEL:
            chat_id = message.forward_from_chat.id
            title = message.forward_from_chat.title
    if chat_id is None:
        return

    text = await _bind_closed_channel(bot, db, settings, chat_id, title=title)
    await message.answer(text)


@router.chat_member(
    ChatMemberUpdatedFilter(IS_NOT_MEMBER >> IS_MEMBER),
    F.chat.type == "channel",
)
async def on_channel_member_join(
    event: ChatMemberUpdated,
    bot,
    db: Database,
    settings: Settings,
) -> None:
    channel_id = await db.get_closed_channel_id(settings)
    if event.chat.id != channel_id:
        return
    user = event.new_chat_member.user
    if user.is_bot:
        return
    invite_url = None
    if event.invite_link:
        invite_url = event.invite_link.invite_link
    await handle_channel_join(
        bot,
        db,
        settings,
        user_id=user.id,
        invite_url=invite_url,
    )
