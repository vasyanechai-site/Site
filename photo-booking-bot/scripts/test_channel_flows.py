#!/usr/bin/env python3
"""Tests for closed channel subscription DB logic."""

import asyncio
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bot.channel_utils import (
    FULL_PRICE_MONTHS_FOR_DISCOUNT,
    InviteLinkStatus,
    SubscriptionStatus,
)  # noqa: E402
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

        # Renewal discount eligibility
        state0 = await db.get_channel_renewal_state(222)
        assert db.can_offer_renewal_discount(state0)

        await db.record_renewal_payment(222, amount=500, full_price=500)
        state1 = await db.get_channel_renewal_state(222)
        assert state1.full_price_renewals_since_discount == 1
        assert not db.can_offer_renewal_discount(state1)

        await db.record_renewal_payment(222, amount=250, full_price=500)
        state2 = await db.get_channel_renewal_state(222)
        assert state2.discount_ever_used
        assert state2.full_price_renewals_since_discount == 0
        assert not db.can_offer_renewal_discount(state2)

        for _ in range(FULL_PRICE_MONTHS_FOR_DISCOUNT):
            await db.record_renewal_payment(222, amount=500, full_price=500)
        state3 = await db.get_channel_renewal_state(222)
        assert db.can_offer_renewal_discount(state3)

        # Pending renewal preserves paid history
        sub_r = await db.ensure_pending_subscription(
            telegram_user_id=333,
            username="renew",
            first_name="Re",
            last_name="New",
            amount=500,
        )
        sub_r = await db.confirm_channel_payment(sub_r.id)
        pending = await db.ensure_pending_renewal(
            telegram_user_id=333,
            username="renew",
            first_name="Re",
            last_name="New",
            amount=500,
        )
        assert pending.status == SubscriptionStatus.PENDING_PAYMENT
        assert pending.paid_at is not None

        from bot.channel_utils import channel_payment_skips_invite
        from bot.utils import now_local_dt

        sub_paid = await db.confirm_channel_payment(pending.id)
        assert sub_paid.status == SubscriptionStatus.ACTIVE
        assert not channel_payment_skips_invite(pending)

        sub_joined = await db.get_channel_subscription_by_id(sub_paid.id)
        sub_joined.joined_at = now_local_dt()
        assert channel_payment_skips_invite(sub_joined)

        print("RESULT: ALL CHANNEL TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(run_tests())
