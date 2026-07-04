from aiogram.filters import BaseFilter
from aiogram.types import CallbackQuery, Message, TelegramObject

from bot.config import Settings


def _is_admin(user_id: int | None, settings: Settings) -> bool:
    return bool(user_id and user_id in settings.admin_ids)


class IsAdminFilter(BaseFilter):
    async def __call__(self, event: TelegramObject, settings: Settings) -> bool:
        user = getattr(event, "from_user", None)
        return _is_admin(user.id if user else None, settings)


class IsAdminCallbackFilter(BaseFilter):
    async def __call__(self, callback: CallbackQuery, settings: Settings) -> bool:
        return _is_admin(callback.from_user.id if callback.from_user else None, settings)
