from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

from bot.database import Slot
from bot.utils import DATE_BUTTON_FORMAT, TIME_BUTTON_FORMAT, SlotStatus, format_date_button, format_time_button


def start_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Записаться"), KeyboardButton(text="Моя запись")],
        ],
        resize_keyboard=True,
    )


def dates_keyboard(dates, prefix: str = "date") -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=format_date_button(date),
                callback_data=f"{prefix}:{date.strftime(DATE_BUTTON_FORMAT)}",
            )
        ]
        for date in dates
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=rows or [[InlineKeyboardButton(text="Нет дат", callback_data="noop")]]
    )


def times_keyboard(slots: list[Slot], prefix: str = "time") -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=format_time_button(slot.slot_at),
                callback_data=f"{prefix}:{slot.id}",
            )
        ]
        for slot in slots
    ]
    return InlineKeyboardMarkup(
        inline_keyboard=rows or [[InlineKeyboardButton(text="Нет времени", callback_data="noop")]]
    )


def payment_keyboard(slot_id: int) -> InlineKeyboardMarkup:
    return active_booking_keyboard(slot_id, show_pay=True)


def active_booking_keyboard(
    slot_id: int,
    *,
    show_pay: bool = False,
    show_reschedule: bool = True,
    show_cancel: bool = True,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if show_pay:
        rows.append([InlineKeyboardButton(text="Оплатить", callback_data=f"pay:{slot_id}")])
    action_row: list[InlineKeyboardButton] = []
    if show_reschedule:
        action_row.append(
            InlineKeyboardButton(text="Перенести запись", callback_data=f"reschedule:{slot_id}")
        )
    if show_cancel:
        action_row.append(
            InlineKeyboardButton(text="Отменить запись", callback_data=f"cancel:{slot_id}")
        )
    if action_row:
        rows.append(action_row)
    return InlineKeyboardMarkup(inline_keyboard=rows or [[InlineKeyboardButton(text="—", callback_data="noop")]])


def delete_slots_keyboard(slots: list[Slot]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=f"{slot.slot_at.strftime('%d.%m.%Y %H:%M')} — {slot.status.label_ru}",
                callback_data=f"delslot:{slot.id}",
            )
        ]
        for slot in slots
        if slot.status.value == "available"
    ]
    if not rows:
        rows = [[InlineKeyboardButton(text="Нет свободных слотов для удаления", callback_data="noop")]]
    return InlineKeyboardMarkup(inline_keyboard=rows)
