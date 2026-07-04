#!/usr/bin/env python3
"""Tests for closed channel subscription DB logic."""

import asyncio
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bot.channel_utils import InviteLinkStatus, SubscriptionStatus  # noqa: E402
from bot.database import Database  # noqa: E402


async def run_tests() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "channel_test.db"
        db = Database(db_path)
        await db.init()

        ch = await db.get_channel_settings()
        assert ch.monthly_price == 500, "default price"

        sub = await db.ensure_pending_subscription(
            telegram_user_id=111,
            username="testuser",
            first_name="Test",
            last_name="User",
            amount=500,
        )
        assert sub.status == SubscriptionStatus.PENDING_PAYMENT

        sub = await db.confirm_channel_payment(sub.id)
        assert sub.status == SubscriptionStatus.ACTIVE
        assert sub.paid_at is not None
        assert sub.ends_at is not None

        invite = await db.save_invite_link(
            subscription_id=sub.id,
            telegram_user_id=111,
            invite_link="https://t.me/+testlink",
            expected_user_id=111,
            expires_at=sub.ends_at,
        )
        assert invite.status == InviteLinkStatus.PENDING

        await db.mark_invite_used(invite.id, used_by_user_id=111, ok=True)
        invite2 = await db.get_invite_by_url("https://t.me/+testlink")
        assert invite2 and invite2.status == InviteLinkStatus.USED_OK

        sub2 = await db.get_channel_subscription_by_id(sub.id)
        assert sub2.joined_at is not None

        assert db.subscription_is_active(sub2)

        stats = await db.get_channel_stats()
        assert stats["active"] >= 1
        assert stats["joined"] >= 1

        wrong = await db.save_invite_link(
            subscription_id=sub.id,
            telegram_user_id=111,
            invite_link="https://t.me/+wrong",
            expected_user_id=111,
            expires_at=sub.ends_at,
        )
        await db.mark_invite_used(wrong.id, used_by_user_id=999, ok=False)
        w2 = await db.get_invite_link_by_id(wrong.id)
        assert w2.status == InviteLinkStatus.USED_WRONG_USER

        await db.cancel_channel_subscription(sub.id)
        sub3 = await db.get_channel_subscription_by_id(sub.id)
        assert sub3.status == SubscriptionStatus.CANCELLED

        print("RESULT: ALL CHANNEL TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(run_tests())
