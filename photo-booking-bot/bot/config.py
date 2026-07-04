import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env variable: {name}")
    return value


def _int(name: str) -> int:
    raw = _require(name)
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got: {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    bot_token: str
    admin_id: int
    phone: str
    recipient_name: str
    full_price: int
    prepay_percent: int
    database_path: Path
    https_proxy: str | None

    @property
    def prepay_amount(self) -> int:
        return round(self.full_price * self.prepay_percent / 100)

    @property
    def phone_display(self) -> str:
        digits = "".join(ch for ch in self.phone if ch.isdigit())
        if digits.startswith("7") and len(digits) == 11:
            digits = "8" + digits[1:]
        if len(digits) == 11 and digits.startswith("8"):
            return f"{digits[0]}-{digits[1:4]}-{digits[4:7]}-{digits[7:9]}-{digits[9:11]}"
        return self.phone


def load_settings() -> Settings:
    db_path = os.getenv("DATABASE_PATH", "data/booking.db").strip()
    proxy = os.getenv("HTTPS_PROXY", "").strip() or os.getenv("TELEGRAM_HTTPS_PROXY", "").strip()
    return Settings(
        bot_token=_require("BOT_TOKEN"),
        admin_id=_int("ADMIN_ID"),
        phone=_require("PHONE"),
        recipient_name=_require("RECIPIENT_NAME"),
        full_price=_int("FULL_PRICE"),
        prepay_percent=_int("PREPAY_PERCENT"),
        database_path=BASE_DIR / db_path,
        https_proxy=proxy or None,
    )
