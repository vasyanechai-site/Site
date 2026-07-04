import logging

from aiogram import F, Router
from aiogram.filters import ChatMemberUpdatedFilter, IS_MEMBER, IS_NOT_MEMBER
from aiogram.types import ChatMemberUpdated

from bot.channel_service import handle_channel_join
from bot.config import Settings
from bot.database import Database

logger = logging.getLogger(__name__)

router = Router()


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
