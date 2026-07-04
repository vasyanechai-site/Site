from aiogram import Router

from bot.filters import IsAdminCallbackFilter, IsAdminFilter

from . import bookings, legacy, menu, payments, settings, slots, stats, voice

router = Router(name="admin")
router.message.filter(IsAdminFilter())
router.callback_query.filter(IsAdminCallbackFilter())

router.include_router(menu.router)
router.include_router(slots.router)
router.include_router(bookings.router)
router.include_router(payments.router)
router.include_router(stats.router)
router.include_router(settings.router)
router.include_router(legacy.router)
router.include_router(voice.router)

__all__ = ["router"]
