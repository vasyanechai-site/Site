import logging

from aiogram import F, Router
from aiogram.enums import ChatType
from aiogram.filters import ChatMemberUpdatedFilter, IS_MEMBER, IS_NOT_MEMBER
from aiogram.types import ChatMemberUpdated

from bot.channel_service import handle_channel_join
from bot.channel_setup import channel_id_env_hint
from bot.config import Settings
from bot.database import Database

logger = logging.getLogger(__name__)

router = Router()


@router.my_chat_member()
async def on_bot_added_to_channel(
    event: ChatMemberUpdated,
    bot,
    settings: Settings,
) -> None:
    chat = event.chat
    if chat.type != ChatType.CHANNEL:
        return
    status = event.new_chat_member.status
    if status not in ("administrator", "creator"):
        return
    env_value = channel_id_env_hint(chat.id)
    text = (
        "Бот добавлен в закрытый канал.\n\n"
        f"Название: {chat.title or '—'}\n"
        f"ID для CLOSED_CHANNEL_ID: {env_value}\n"
        f"Полный chat_id: {chat.id}\n\n"
        "Укажите это значение в GitHub Secret CLOSED_CHANNEL_ID и перезапустите деплой бота.\n"
        "Право «приглашать пользователей по ссылке» должно быть включено."
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception:
            logger.exception("Failed to send channel id hint to admin %s", admin_id)


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
    if event.chat.id != settings.closed_channel_id:
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
