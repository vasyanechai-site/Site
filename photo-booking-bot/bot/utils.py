from datetime import datetime
from enum import StrEnum


class SlotStatus(StrEnum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    AWAITING_PAYMENT = "awaiting_payment"
    PREPAID = "prepaid"
    PAID_FULL = "paid_full"

    @property
    def label_ru(self) -> str:
        return {
            SlotStatus.AVAILABLE: "Свободен",
            SlotStatus.RESERVED: "Забронирован",
            SlotStatus.AWAITING_PAYMENT: "Ожидает оплату",
            SlotStatus.PREPAID: "Предоплата внесена",
            SlotStatus.PAID_FULL: "Оплачено полностью",
        }[self]

    @property
    def is_occupied(self) -> bool:
        return self != SlotStatus.AVAILABLE


class BookingStatus(StrEnum):
    RESERVED = "reserved"
    AWAITING_PAYMENT = "awaiting_payment"
    PREPAID = "prepaid"
    PAID_FULL = "paid_full"
    CANCELLED = "cancelled"

    @property
    def label_ru(self) -> str:
        return {
            BookingStatus.RESERVED: "Забронирован",
            BookingStatus.AWAITING_PAYMENT: "Ожидает оплату",
            BookingStatus.PREPAID: "Предоплата внесена",
            BookingStatus.PAID_FULL: "Оплачено полностью",
            BookingStatus.CANCELLED: "Отменено",
        }[self]


SLOT_TO_BOOKING = {
    SlotStatus.RESERVED: BookingStatus.RESERVED,
    SlotStatus.AWAITING_PAYMENT: BookingStatus.AWAITING_PAYMENT,
    SlotStatus.PREPAID: BookingStatus.PREPAID,
    SlotStatus.PAID_FULL: BookingStatus.PAID_FULL,
}


SLOT_DATETIME_FORMAT = "%d.%m.%Y %H:%M"
DATE_BUTTON_FORMAT = "%d.%m.%Y"
TIME_BUTTON_FORMAT = "%H:%M"


def parse_slot_datetime(text: str) -> datetime:
    cleaned = " ".join(text.strip().split())
    return datetime.strptime(cleaned, SLOT_DATETIME_FORMAT)


def parse_stored_datetime(value: str) -> datetime:
    """Парсит slot_at из БД (локальный ISO или legacy UTC с Z)."""
    cleaned = value.strip()
    if cleaned.endswith("Z"):
        from datetime import timezone

        dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        return dt.astimezone().replace(tzinfo=None)
    # SQLite / legacy: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
    normalized = cleaned.replace(" ", "T", 1) if " " in cleaned and "T" not in cleaned else cleaned
    if len(normalized) > 19:
        normalized = normalized[:19]
    return datetime.fromisoformat(normalized)


def now_local_iso() -> str:
    return datetime.now().replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")


def now_local_dt() -> datetime:
    return datetime.now().replace(second=0, microsecond=0)


def slot_to_iso(dt: datetime) -> str:
    return dt.replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")


def format_slot_datetime(dt: datetime) -> str:
    return dt.strftime(SLOT_DATETIME_FORMAT)


def format_date_button(dt: datetime) -> str:
    return dt.strftime(DATE_BUTTON_FORMAT)


def format_time_button(dt: datetime) -> str:
    return dt.strftime(TIME_BUTTON_FORMAT)


def user_display_name(first_name: str | None, last_name: str | None) -> str:
    parts = [part for part in (first_name, last_name) if part]
    return " ".join(parts) if parts else "—"


def format_phone_display(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("7") and len(digits) == 11:
        digits = "8" + digits[1:]
    if len(digits) == 11 and digits.startswith("8"):
        return f"{digits[0]}-{digits[1:4]}-{digits[4:7]}-{digits[7:9]}-{digits[9:11]}"
    return phone
