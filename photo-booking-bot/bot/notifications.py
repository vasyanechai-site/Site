import logging

from aiogram import Bot
from aiogram.types import User

from bot.config import Settings
from bot.database import Slot
from bot.utils import format_slot_datetime

logger = logging.getLogger(__name__)


def _username_line(user: User) -> str:
    return f"@{user.username}" if user.username else "нет username"


async def notify_admins(
    bot: Bot,
    settings: Settings,
    *,
    title: str,
    user: User,
    slot: Slot,
    prepay: int | None = None,
    footer: str | None = None,
) -> None:
    lines = [
        title,
        "",
        f"Имя: {user.full_name}",
        f"Username: {_username_line(user)}",
        f"Telegram ID: <code>{user.id}</code>",
        f"📅 {format_slot_datetime(slot.slot_at)}",
    ]
    if prepay is not None:
        lines.append(f"Предоплата: {prepay} ₽")
    lines.append(f"Статус: {slot.status.label_ru}")
    if footer:
        lines.append(footer)

    text = "\n".join(lines)
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            logger.exception("Failed to notify admin %s", admin_id)
