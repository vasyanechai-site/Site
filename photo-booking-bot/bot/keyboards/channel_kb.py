from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.channel_utils import channel_open_url


def channel_intro_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Оплатить", callback_data="ch:pay"),
                InlineKeyboardButton(text="Отменить", callback_data="ch:cancel"),
            ]
        ]
    )


def channel_payment_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Оплачено", callback_data="ch:paid")],
            [InlineKeyboardButton(text="Отменить", callback_data="ch:cancel")],
        ]
    )


def channel_active_kb(channel_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Открыть канал", url=channel_open_url(channel_id))],
        ]
    )


def channel_invite_kb(invite_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Вступить в канал", url=invite_url)],
        ]
    )


def channel_renew_48h_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Продлить подписку", callback_data="ch:renew")],
        ]
    )


def channel_renew_24h_kb(*, discount: bool) -> InlineKeyboardMarkup:
    callback_data = "ch:renew:disc" if discount else "ch:renew"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Оплатить", callback_data=callback_data)],
        ]
    )
