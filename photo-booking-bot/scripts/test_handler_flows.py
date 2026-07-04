#!/usr/bin/env python3
"""Handler-level tests через Dispatcher (без реального Telegram)."""
from __future__ import annotations

import asyncio
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, Chat, Message, Update, User

from bot.config import Settings
from bot.database import Database
from bot.handlers import admin, channel, channel_member, user as user_handlers
from bot.middleware import ErrorLoggingMiddleware, InjectMiddleware
from bot.utils import SlotStatus

USER_ID = 111222333
USER2_ID = 444555666
ADMIN_ID = 999888777


class TestResult:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[str] = []

    def ok(self, name: str) -> None:
        self.passed.append(name)

    def fail(self, name: str, detail: str) -> None:
        self.failed.append(f"{name}: {detail}")


def make_settings(db_path: Path) -> Settings:
    return Settings(
        bot_token="TEST:TOKEN",
        admin_id=ADMIN_ID,
        admin_ids=frozenset({ADMIN_ID}),
        phone="+79001234567",
        recipient_name="Test Recipient",
        database_path=db_path,
        https_proxy=None,
        telegram_api_base=None,
        openai_api_key=None,
        closed_channel_id=-1001234567890,
    )


def make_bot() -> Bot:
    sent: list[str] = []

    async def bot_call(method):
        sent.append(type(method).__name__)
        return Message(
            message_id=99,
            date=datetime.now(),
            chat=Chat(id=USER_ID, type="private"),
        )

    bot = AsyncMock(spec=Bot)
    bot.side_effect = bot_call
    bot.sent = sent  # type: ignore[attr-defined]
    bot.create_chat_invite_link = AsyncMock()
    return bot


def make_dispatcher(db: Database, settings: Settings) -> Dispatcher:
    dp = Dispatcher(storage=MemoryStorage())
    dp.update.middleware(InjectMiddleware(db, settings))
    dp.update.middleware(ErrorLoggingMiddleware())
    dp.include_router(channel.router)
    dp.include_router(channel_member.router)
    dp.include_router(admin.router)
    dp.include_router(user_handlers.router)
    return dp


def user_message(*, user_id: int, text: str, message_id: int = 1) -> Update:
    user = User(id=user_id, is_bot=False, first_name="Test", username="testuser")
    chat = Chat(id=user_id, type="private")
    msg = Message(message_id=message_id, date=datetime.now(), chat=chat, from_user=user, text=text)
    return Update(update_id=message_id, message=msg)


def callback_update(
    *,
    user_id: int,
    data: str,
    message_id: int = 10,
    callback_id: str = "cb1",
) -> Update:
    user = User(id=user_id, is_bot=False, first_name="Test", username="testuser")
    chat = Chat(id=user_id, type="private")
    msg = Message(message_id=message_id, date=datetime.now(), chat=chat, from_user=user, text="ctx")
    cb = CallbackQuery(
        id=callback_id,
        from_user=user,
        chat_instance="inst",
        data=data,
        message=msg,
    )
    return Update(update_id=message_id + 1000, callback_query=cb)


async def setup_db(db: Database) -> int:
    """Create slot and return slot_id."""
    t = datetime.now().replace(second=0, microsecond=0) + timedelta(days=7)
    t = t.replace(hour=10, minute=0)
    await db.add_slot(t)
    slots = await db.list_available_times_for_date(t)
    return slots[0].id


async def run_handler_scenarios(r: TestResult) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "handler_test.db"
        db = Database(db_path)
        await db.init()
        settings = make_settings(db_path)
        dp = make_dispatcher(db, settings)
        bot = make_bot()

        # --- New user /start ---
        try:
            await dp.feed_update(bot, user_message(user_id=USER2_ID, text="/start"))
            if "SendMessage" not in bot.sent:
                r.fail("New user /start", f"no SendMessage, got {bot.sent}")
            else:
                r.ok("New user: /start отвечает")
        except Exception as exc:
            r.fail("New user /start", str(exc))

        bot.sent.clear()

        # --- User books slot ---
        slot_id = await setup_db(db)
        pricing = await db.get_pricing()
        await db.reserve_slot(
            slot_id=slot_id,
            user_id=USER_ID,
            username="u1",
            first_name="U",
            last_name="1",
            prepayment_amount=pricing.prepay_amount,
            total_amount=pricing.full_price,
        )

        # --- Моя запись (non-admin with booking) ---
        try:
            await dp.feed_update(bot, user_message(user_id=USER_ID, text="Моя запись", message_id=2))
            if not bot.sent:
                r.fail("User my_booking", "no response")
            else:
                r.ok("User с записью: «Моя запись»")
        except Exception as exc:
            r.fail("User my_booking", str(exc))

        bot.sent.clear()

        # --- Записаться when already booked ---
        try:
            await dp.feed_update(bot, user_message(user_id=USER_ID, text="Записаться", message_id=3))
            if not bot.sent:
                r.fail("User booking_start active", "no response")
            else:
                r.ok("User с записью: «Записаться» показывает текущую запись")
        except Exception as exc:
            r.fail("User booking_start active", str(exc))

        # --- Pay callback (direct handler) ---
        try:
            from bot.handlers.user import pay_booking, reschedule_start, cancel_booking

            cb = MagicMock()
            cb.from_user = User(id=USER_ID, is_bot=False, first_name="Test", username="testuser")
            cb.data = f"pay:{slot_id}"
            cb.message = MagicMock()
            cb.message.edit_text = AsyncMock()
            cb.answer = AsyncMock()
            bot.sent.clear()
            await pay_booking(cb, db=db, settings=settings, bot=bot)
            if not cb.answer.await_count:
                r.fail("User pay callback", "callback.answer not called")
            else:
                slot = await db.get_slot(slot_id)
                if slot.status != SlotStatus.AWAITING_PAYMENT:
                    r.fail("User pay callback", f"status={slot.status}")
                else:
                    r.ok("User: оплата (callback pay:)")
        except Exception as exc:
            r.fail("User pay callback", str(exc))

        # --- Reschedule callback ---
        try:
            dates = await db.list_available_dates()
            if len(dates) < 2:
                base = dates[0] if dates else datetime.now() + timedelta(days=7)
                await db.add_slot(base + timedelta(days=1, hours=4))
            cb = MagicMock()
            cb.from_user = User(id=USER_ID, is_bot=False, first_name="Test", username="testuser")
            cb.data = f"reschedule:{slot_id}"
            cb.message = MagicMock()
            cb.message.edit_text = AsyncMock()
            cb.answer = AsyncMock()
            state = dp.fsm.get_context(bot=bot, chat_id=USER_ID, user_id=USER_ID)
            await state.clear()
            await reschedule_start(cb, db=db, state=state)
            if not cb.answer.await_count:
                r.fail("User reschedule callback", "callback.answer not called")
            else:
                r.ok("User: перенос записи (callback reschedule:)")
        except Exception as exc:
            r.fail("User reschedule callback", str(exc))

        # --- Cancel booking callback ---
        current = await db.get_user_active_slot(USER_ID)
        cancel_target = current.id if current else slot_id
        try:
            cb = MagicMock()
            cb.from_user = User(id=USER_ID, is_bot=False, first_name="Test", username="testuser")
            cb.data = f"cancel:{cancel_target}"
            cb.message = MagicMock()
            cb.message.edit_text = AsyncMock()
            cb.message.edit_reply_markup = AsyncMock()
            cb.message.answer = AsyncMock()
            cb.answer = AsyncMock()
            state = dp.fsm.get_context(bot=bot, chat_id=USER_ID, user_id=USER_ID)
            await cancel_booking(cb, db=db, state=state, settings=settings)
            if not cb.answer.await_count:
                r.fail("User cancel callback", "callback.answer not called")
            elif await db.get_user_active_slot(USER_ID):
                r.fail("User cancel callback", "slot still active")
            else:
                r.ok("User: отмена записи (callback cancel:)")
        except Exception as exc:
            r.fail("User cancel callback", str(exc))

        # --- Paid channel user ---
        try:
            from bot.handlers.channel import _open_channel_for_user

            sub = await db.ensure_pending_subscription(
                telegram_user_id=USER2_ID,
                username="chuser",
                first_name="Ch",
                last_name="User",
                amount=500,
            )
            await db.confirm_channel_payment(sub.id)
            answers: list[str] = []

            async def answer(text, **kwargs):
                answers.append(str(text))

            await _open_channel_for_user(
                bot=bot,
                db=db,
                settings=settings,
                user_id=USER2_ID,
                answer=answer,
            )
            if not answers:
                r.fail("Channel paid user", "no response")
            else:
                r.ok("User: оплативший закрытый канал — «Закрытый канал»")
        except Exception as exc:
            r.fail("Channel paid user", str(exc))

        bot.sent.clear()
        try:
            await dp.feed_update(bot, user_message(user_id=USER2_ID, text="Закрытый канал", message_id=20))
            if not bot.sent:
                r.fail("User closed channel", "no response")
            else:
                r.ok("User: «Закрытый канал» отвечает")
        except Exception as exc:
            r.fail("User closed channel", str(exc))

        bot.sent.clear()
        try:
            await dp.feed_update(bot, user_message(user_id=ADMIN_ID, text="/start", message_id=30))
            if not bot.sent:
                r.fail("Admin /start", "no response")
            else:
                r.ok("Admin: /start отвечает")
        except Exception as exc:
            r.fail("Admin /start", str(exc))

        bot.sent.clear()
        try:
            await dp.feed_update(bot, user_message(user_id=USER2_ID, text="⚙️ Админка", message_id=31))
            if not bot.sent:
                r.fail("Non-admin admin button", "expected fallback response")
            else:
                r.ok("Non-admin: «Админка» → fallback (не админ-меню)")
        except Exception as exc:
            r.fail("Non-admin admin button", str(exc))


async def main() -> int:
    r = TestResult()
    await run_handler_scenarios(r)

    print("\n" + "=" * 60)
    print("HANDLER TEST REPORT — Photo Booking Bot")
    print("=" * 60)
    print(f"\nPASSED ({len(r.passed)}):")
    for name in r.passed:
        print(f"  • {name}")

    if r.failed:
        print(f"\nFAILED ({len(r.failed)}):")
        for f in r.failed:
            print(f"  • {f}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: ALL HANDLER TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
