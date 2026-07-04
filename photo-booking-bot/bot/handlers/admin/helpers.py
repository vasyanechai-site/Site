"""Общие хелперы для админ-handlers."""

from bot.database import BookingRow
from bot.utils import format_slot_datetime, user_display_name


def format_booking_card(booking: BookingRow) -> str:
    username = f"@{booking.telegram_username}" if booking.telegram_username else "нет username"
    name = user_display_name(booking.telegram_first_name, booking.telegram_last_name)
    tg_link = f'<a href="tg://user?id={booking.telegram_user_id}">{name}</a>'
    lines = [
        f"📋 <b>Запись #{booking.id}</b>",
        f"📅 {format_slot_datetime(booking.slot_at)}",
        f"Статус: {booking.status.label_ru}",
        f"Клиент: {tg_link}",
        f"Username: {username}",
        f"Telegram ID: <code>{booking.telegram_user_id}</code>",
        f"Предоплата: {booking.prepayment_amount} ₽ / {booking.total_amount} ₽",
    ]
    if booking.admin_comment:
        lines.append(f"💬 {booking.admin_comment}")
    return "\n".join(lines)
