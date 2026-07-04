#!/usr/bin/env python3
"""Тесты админ-методов Database для Telegram CRM."""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bot.database import Database  # noqa: E402
from bot.utils import BookingStatus, SlotStatus  # noqa: E402

USER_ID = 111222333


class TestResult:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[str] = []

    def ok(self, name: str) -> None:
        self.passed.append(name)

    def fail(self, name: str, detail: str) -> None:
        self.failed.append(f"{name}: {detail}")


async def run_admin_db_tests(db: Database, r: TestResult) -> None:
    now = datetime.now().replace(second=0, microsecond=0)
    t1 = (now + timedelta(days=5)).replace(hour=10, minute=0)
    t2 = (now + timedelta(days=5)).replace(hour=14, minute=0)
    t3 = (now + timedelta(days=6)).replace(hour=11, minute=0)

    await db.add_slot(t1)
    await db.add_slot(t2)
    await db.add_slot(t3)

    # pricing
    try:
        await db.update_pricing(3500, 40)
        p = await db.get_pricing()
        if p.full_price != 3500 or p.prepay_percent != 40:
            r.fail("update_pricing", f"got {p}")
        else:
            r.ok("update_pricing / get_pricing")
    except Exception as e:
        r.fail("update_pricing", str(e))

    # contact settings
    try:
        await db.update_contact_settings(phone="+79991234567", recipient_name="Test Recipient")
        c = await db.get_contact_settings(env_phone="fallback", env_recipient="Fallback")
        if c.phone != "+79991234567" or c.recipient_name != "Test Recipient":
            r.fail("update_contact_settings", f"got {c}")
        else:
            r.ok("contact settings read/write")
        c2 = await db.get_contact_settings(env_phone="env-phone", env_recipient="env-name")
        await db.update_contact_settings(phone="", recipient_name="")
        c3 = await db.get_contact_settings(env_phone="env-phone", env_recipient="env-name")
        if c3.phone != "env-phone" or c3.recipient_name != "env-name":
            r.fail("contact env fallback", f"got {c3}")
        else:
            r.ok("contact settings env fallback")
    except Exception as e:
        r.fail("contact settings", str(e))

    # stats
    try:
        stats = await db.get_stats()
        if stats.counts.get("available", 0) < 3:
            r.fail("get_stats", f"available={stats.counts.get('available')}")
        else:
            r.ok(f"get_stats (available={stats.counts.get('available')})")
    except Exception as e:
        r.fail("get_stats", str(e))

    # list_slots_filtered / list_slots_by_date
    try:
        avail = await db.list_slots_filtered("available")
        occ = await db.list_slots_filtered("occupied")
        by_date = await db.list_slots_by_date(t1)
        if len(avail) < 3:
            r.fail("list_slots_filtered available", str(len(avail)))
        elif len(occ) != 0:
            r.fail("list_slots_filtered occupied", str(len(occ)))
        elif len(by_date) < 2:
            r.fail("list_slots_by_date", str(len(by_date)))
        else:
            r.ok("list_slots_filtered + list_slots_by_date")
    except Exception as e:
        r.fail("list slots", str(e))

    # update_slot_time
    try:
        free = await db.list_slots_filtered("available")
        slot_id = free[0].id
        new_time = free[0].slot_at + timedelta(hours=1)
        updated = await db.update_slot_time(slot_id, new_time)
        if updated.slot_at != new_time.replace(second=0, microsecond=0):
            r.fail("update_slot_time", "time mismatch")
        else:
            r.ok("update_slot_time (available only)")
        try:
            await db.reserve_slot(
                slot_id=free[1].id,
                user_id=USER_ID,
                username="u",
                first_name="U",
                last_name="S",
                prepayment_amount=100,
                total_amount=200,
            )
            await db.update_slot_time(free[1].id, new_time)
            r.fail("update_slot_time occupied", "should raise")
        except ValueError:
            r.ok("update_slot_time blocked for occupied")
    except Exception as e:
        r.fail("update_slot_time", str(e))

    # bookings
    try:
        pricing = await db.get_pricing()
        slots = await db.list_slots_filtered("available")
        if not slots:
            r.fail("bookings setup", "no free slot")
            return
        sid = slots[0].id
        await db.reserve_slot(
            slot_id=sid,
            user_id=USER_ID,
            username="bookuser",
            first_name="Book",
            last_name="User",
            prepayment_amount=pricing.prepay_amount,
            total_amount=pricing.full_price,
        )
        await db.mark_awaiting_payment(sid, USER_ID)

        awaiting = await db.list_bookings(status=BookingStatus.AWAITING_PAYMENT, future=True)
        found = await db.list_bookings(search="bookuser")
        if not awaiting:
            r.fail("list_bookings", "empty awaiting list")
        elif not found:
            r.fail("list_bookings search", "no match")
        else:
            r.ok("list_bookings + search")

        booking = awaiting[0]
        if not booking.slot_at:
            r.fail("get_booking", "missing slot_at")
        else:
            r.ok("get_booking (BookingRow.slot_at)")

        updated = await db.update_booking(booking.id, status=BookingStatus.PREPAID, admin_comment="ok")
        if updated.status != BookingStatus.PREPAID or updated.admin_comment != "ok":
            r.fail("update_booking", f"got {updated.status}/{updated.admin_comment}")
        else:
            slot = await db.get_slot(booking.slot_id)
            if slot.status != SlotStatus.PREPAID:
                r.fail("update_booking slot sync", str(slot.status))
            else:
                r.ok("update_booking + slot status sync")

        cancelled = await db.update_booking(booking.id, status=BookingStatus.CANCELLED)
        slot = await db.get_slot(booking.slot_id)
        if cancelled.status != BookingStatus.CANCELLED or slot.status != SlotStatus.AVAILABLE:
            r.fail("cancel booking", f"{cancelled.status}/{slot.status}")
        else:
            r.ok("update_booking cancel frees slot")
    except Exception as e:
        r.fail("bookings", str(e))


async def main() -> int:
    r = TestResult()
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test_admin.db"
        os.environ["DATABASE_PATH"] = str(db_path)
        db = Database(db_path)
        await db.init()
        await run_admin_db_tests(db, r)

    print("\n" + "=" * 60)
    print("QA TEST REPORT — Admin DB methods")
    print("=" * 60)
    print(f"\n✅ PASSED ({len(r.passed)}):")
    for name in r.passed:
        print(f"  • {name}")
    if r.failed:
        print(f"\n❌ FAILED ({len(r.failed)}):")
        for f in r.failed:
            print(f"  • {f}")
        print("\nRESULT: FAIL")
        return 1
    print("\nRESULT: ALL ADMIN DB TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
