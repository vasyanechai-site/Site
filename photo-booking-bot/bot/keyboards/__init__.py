from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

from bot.database import Slot
from bot.utils import DATE_BUTTON_FORMAT, format_date_button, format_slot_datetime, format_time_button


def start_keyboard(*, is_admin: bool = False) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text="Записаться"), KeyboardButton(text="Моя запись")],
        [KeyboardButton(text="Закрытый канал")],
    ]
    if is_admin:
        rows.append([KeyboardButton(text="⚙️ Админка")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def dates_keyboard(
    dates,
    prefix: str = "date",
    *,
    booking_slot_id: int | None = None,
) -> InlineKeyboardMarkup:
    rows = []
    for date in dates:
        date_key = date.strftime(DATE_BUTTON_FORMAT)
        if booking_slot_id is not None:
            cb = f"{prefix}:{booking_slot_id}:{date_key}"
        else:
            cb = f"{prefix}:{date_key}"
        rows.append(
            [
                InlineKeyboardButton(
                    text=format_date_button(date),
                    callback_data=cb,
                )
            ]
        )
    if not rows:
        rows = [[InlineKeyboardButton(text="Нет свободных дат", callback_data="noop")]]
    cancel_cb = (
        f"flow:cancel_reschedule:{booking_slot_id}"
        if booking_slot_id is not None
        else "flow:cancel"
    )
    rows.append([InlineKeyboardButton(text="Отмена", callback_data=cancel_cb)])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def times_keyboard(
    slots: list[Slot],
    prefix: str = "time",
    *,
    booking_slot_id: int | None = None,
    back_callback: str = "flow:back_dates",
) -> InlineKeyboardMarkup:
    rows = []
    for slot in slots:
        if booking_slot_id is not None:
            cb = f"{prefix}:{booking_slot_id}:{slot.id}"
        else:
            cb = f"{prefix}:{slot.id}"
        rows.append(
            [
                InlineKeyboardButton(
                    text=format_time_button(slot.slot_at),
                    callback_data=cb,
                )
            ]
        )
    if not rows:
        rows = [[InlineKeyboardButton(text="Нет свободного времени", callback_data="noop")]]
    rows.append(
        [
            InlineKeyboardButton(text="← Другая дата", callback_data=back_callback),
            InlineKeyboardButton(
                text="Отмена",
                callback_data=(
                    f"flow:cancel_reschedule:{booking_slot_id}"
                    if booking_slot_id is not None
                    else "flow:cancel"
                ),
            ),
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def nearest_slots_keyboard(slots: list[Slot]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=format_slot_datetime(slot.slot_at),
                callback_data=f"time:{slot.id}",
            )
        ]
        for slot in slots
    ]
    if not rows:
        rows = [[InlineKeyboardButton(text="Нет свободных слотов", callback_data="noop")]]
    rows.append([InlineKeyboardButton(text="Все даты", callback_data="flow:back_dates")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


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
