from enum import StrEnum
import re


class SubscriptionStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

    @property
    def label_ru(self) -> str:
        return {
            SubscriptionStatus.PENDING_PAYMENT: "Ожидает оплату",
            SubscriptionStatus.ACTIVE: "Активна",
            SubscriptionStatus.EXPIRED: "Истекла",
            SubscriptionStatus.CANCELLED: "Отменена",
        }[self]


class InviteLinkStatus(StrEnum):
    PENDING = "pending"
    USED_OK = "used_ok"
    USED_WRONG_USER = "used_wrong_user"
    EXPIRED = "expired"
    REVOKED = "revoked"

    @property
    def label_ru(self) -> str:
        return {
            InviteLinkStatus.PENDING: "Ожидает",
            InviteLinkStatus.USED_OK: "Использована",
            InviteLinkStatus.USED_WRONG_USER: "Чужой пользователь",
            InviteLinkStatus.EXPIRED: "Истекла",
            InviteLinkStatus.REVOKED: "Отозвана",
        }[self]


SUBSCRIPTION_PERIOD_DAYS = 30
INVITE_EXPIRE_HOURS = 24
RENEWAL_DISCOUNT_PERCENT = 50
REMINDER_48H_HOURS = 48
REMINDER_24H_HOURS = 24
FULL_PRICE_MONTHS_FOR_DISCOUNT = 3
RENEWAL_FEEDBACK_USERNAME = "anyutaporohina"


def renewal_discounted_price(full_price: int) -> int:
    return max(1, round(full_price * (100 - RENEWAL_DISCOUNT_PERCENT) / 100))


def channel_payment_skips_invite(sub, *, now=None) -> bool:
    """Invite is skipped only when extending before expiry for a user already in the channel."""
    from bot.utils import now_local_dt

    now = now or now_local_dt()
    return (
        sub.joined_at is not None
        and sub.paid_at is not None
        and sub.ends_at is not None
        and sub.ends_at > now
    )


def resolve_channel_id(raw: str | int) -> int:
    """393215352 → -100393215352 for supergroup/channel."""
    cid = int(raw)
    if cid > 0:
        return int(f"-100{cid}")
    return cid


def parse_channel_id_from_text(text: str) -> int | None:
    """Extract Telegram channel chat_id from t.me/c/ link or -100… id."""
    if not text:
        return None
    m = re.search(r"(?:https?://)?t\.me/c/(\d+)/", text.strip())
    if m:
        return int(f"-100{m.group(1)}")
    m = re.search(r"(-100\d{6,})", text)
    if m:
        return int(m.group(1))
    stripped = text.strip()
    if stripped.isdigit() and len(stripped) >= 9:
        return resolve_channel_id(stripped)
    return None


def channel_open_url(channel_id: int) -> str:
    s = str(abs(channel_id))
    if s.startswith("100"):
        s = s[3:]
    return f"https://t.me/c/{s}/1"
