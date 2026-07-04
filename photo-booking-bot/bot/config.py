import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = (BASE_DIR / "data" / "booking.db").resolve()
load_dotenv(BASE_DIR / ".env", override=False)


def _resolve_db_path() -> Path:
    raw = os.getenv("DATABASE_PATH", "").strip()
    if not raw:
        return DEFAULT_DB_PATH
    path = Path(raw)
    if path.is_absolute():
        return path.resolve()
    return (BASE_DIR / path).resolve()


from bot.channel_utils import resolve_channel_id

DEFAULT_RELAY_URL = "https://telegram-relay.coffeenechai.workers.dev"


def _resolve_telegram_proxy_url() -> str:
    """Всегда telegram-relay; игнорируем сломанный telegram-bot-proxy из секретов."""
    candidates = [
        os.getenv("TELEGRAM_RELAY_URL", "").strip(),
        os.getenv("TELEGRAM_BOT_PROXY_URL", "").strip(),
    ]
    for url in candidates:
        if not url:
            continue
        if "telegram-bot-proxy" in url or "<" in url or "account" in url.lower():
            continue
        if "telegram-relay" in url and "workers.dev" in url:
            return url.rstrip("/")
    return DEFAULT_RELAY_URL


def _resolve_telegram_proxy_secret() -> str:
    return (
        os.getenv("TELEGRAM_BOT_PROXY_SECRET", "").strip()
        or os.getenv("TELEGRAM_RELAY_SECRET", "").strip()
    )


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


def _optional_int(name: str) -> int | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got: {raw!r}") from exc


def get_admin_ids() -> frozenset[int]:
    raw = os.getenv("ADMIN_IDS", "").strip()
    if raw:
        ids: list[int] = []
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                ids.append(int(part))
            except ValueError as exc:
                raise RuntimeError(f"ADMIN_IDS contains invalid id: {part!r}") from exc
        if not ids:
            raise RuntimeError("ADMIN_IDS is set but empty")
        return frozenset(ids)
    admin_id = _optional_int("ADMIN_ID")
    if admin_id is None:
        raise RuntimeError("Missing required env variable: ADMIN_ID or ADMIN_IDS")
    return frozenset({admin_id})


@dataclass(frozen=True)
class Settings:
    bot_token: str
    admin_id: int
    admin_ids: frozenset[int]
    phone: str
    recipient_name: str
    database_path: Path
    https_proxy: str | None
    telegram_api_base: str | None
    openai_api_key: str | None
    closed_channel_id: int

    @property
    def phone_display(self) -> str:
        from bot.utils import format_phone_display

        return format_phone_display(self.phone)


def load_settings() -> Settings:
    database_path = _resolve_db_path()
    proxy = os.getenv("HTTPS_PROXY", "").strip() or os.getenv("TELEGRAM_HTTPS_PROXY", "").strip()

    proxy_url = _resolve_telegram_proxy_url()
    proxy_secret = _resolve_telegram_proxy_secret()
    telegram_api_base = (
        f"{proxy_url}/{proxy_secret}" if proxy_secret else None
    )

    admin_ids = get_admin_ids()
    primary_admin = min(admin_ids)

    return Settings(
        bot_token=_require("BOT_TOKEN"),
        admin_id=primary_admin,
        admin_ids=admin_ids,
        phone=_require("PHONE"),
        recipient_name=_require("RECIPIENT_NAME"),
        database_path=database_path,
        https_proxy=proxy or None,
        telegram_api_base=telegram_api_base,
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip() or None,
        closed_channel_id=resolve_channel_id(
            os.getenv("CLOSED_CHANNEL_ID", "").strip() or "0"
        ),
    )
