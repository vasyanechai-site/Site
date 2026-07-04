from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import aiosqlite

from bot.utils import (
    BookingStatus,
    SlotStatus,
    format_slot_datetime,
    now_local_iso,
    parse_slot_datetime,
    parse_stored_datetime,
    slot_to_iso,
)


@dataclass
class Slot:
    id: int
    slot_at: datetime
    status: SlotStatus
    user_id: int | None
    username: str | None
    first_name: str | None
    last_name: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Booking:
    id: int
    slot_id: int
    telegram_user_id: int
    telegram_username: str | None
    telegram_first_name: str | None
    telegram_last_name: str | None
    status: BookingStatus
    prepayment_amount: int
    total_amount: int
    admin_comment: str | None
    created_at: datetime
    updated_at: datetime
    slot_at: datetime | None = None


@dataclass
class Pricing:
    full_price: int
    prepay_percent: int

    @property
    def prepay_amount(self) -> int:
        return round(self.full_price * self.prepay_percent / 100)


class Database:
    def __init__(self, path: Path):
        self.path = path

    async def _connect(self):
        db = await aiosqlite.connect(str(self.path))
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")
        return db

    async def init(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        async with await self._connect() as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS slots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slot_at TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'available',
                    user_id INTEGER,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    booked_at TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slot_id INTEGER NOT NULL,
                    telegram_user_id INTEGER NOT NULL,
                    telegram_username TEXT,
                    telegram_first_name TEXT,
                    telegram_last_name TEXT,
                    status TEXT NOT NULL,
                    prepayment_amount INTEGER NOT NULL DEFAULT 0,
                    total_amount INTEGER NOT NULL DEFAULT 0,
                    admin_comment TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (slot_id) REFERENCES slots(id)
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    full_price INTEGER NOT NULL DEFAULT 3000,
                    prepay_percent INTEGER NOT NULL DEFAULT 50,
                    updated_at TEXT
                )
                """
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_slots_status_at ON slots(status, slot_at)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)"
            )
            await self._migrate_columns(db)
            await self._migrate_legacy_bookings(db)
            await self._normalize_utc_slot_timestamps(db)
            await self._ensure_pricing_defaults(db)
            await db.commit()

    async def _normalize_utc_slot_timestamps(self, db: aiosqlite.Connection) -> None:
        async with db.execute("SELECT id, slot_at FROM slots WHERE slot_at LIKE '%Z'") as cursor:
            rows = await cursor.fetchall()
        for row_id, slot_at in rows:
            local_iso = slot_to_iso(parse_stored_datetime(slot_at))
            await db.execute("UPDATE slots SET slot_at = ? WHERE id = ?", (local_iso, row_id))

    async def _ensure_pricing_defaults(self, db: aiosqlite.Connection) -> None:
        now = datetime.now().isoformat()
        await db.execute(
            """
            INSERT OR IGNORE INTO app_settings (id, full_price, prepay_percent, updated_at)
            VALUES (1, 3000, 50, ?)
            """,
            (now,),
        )

    async def get_pricing(self) -> Pricing:
        async with await self._connect() as db:
            async with db.execute(
                "SELECT full_price, prepay_percent FROM app_settings WHERE id = 1"
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return Pricing(full_price=3000, prepay_percent=50)
                return Pricing(full_price=int(row[0]), prepay_percent=int(row[1]))

    async def _migrate_columns(self, db: aiosqlite.Connection) -> None:
        async with db.execute("PRAGMA table_info(slots)") as cursor:
            columns = {row[1] for row in await cursor.fetchall()}
        now = datetime.now().isoformat()
        if "created_at" not in columns:
            await db.execute("ALTER TABLE slots ADD COLUMN created_at TEXT")
            await db.execute("UPDATE slots SET created_at = ? WHERE created_at IS NULL", (now,))
        if "updated_at" not in columns:
            await db.execute("ALTER TABLE slots ADD COLUMN updated_at TEXT")
            await db.execute("UPDATE slots SET updated_at = ? WHERE updated_at IS NULL", (now,))

    async def _migrate_legacy_bookings(self, db: aiosqlite.Connection) -> None:
        async with db.execute(
            """
            SELECT id, slot_at, status, user_id, username, first_name, last_name, booked_at
            FROM slots
            WHERE user_id IS NOT NULL AND status != ?
            """,
            (SlotStatus.AVAILABLE.value,),
        ) as cursor:
            rows = await cursor.fetchall()

        for row in rows:
            slot_id, _slot_at, status, user_id, username, first_name, last_name, booked_at = row
            async with db.execute(
                "SELECT id FROM bookings WHERE slot_id = ? AND status != ? LIMIT 1",
                (slot_id, BookingStatus.CANCELLED.value),
            ) as cursor:
                exists = await cursor.fetchone()
            if exists:
                continue
            try:
                booking_status = BookingStatus.RESERVED
                if status == SlotStatus.AWAITING_PAYMENT.value:
                    booking_status = BookingStatus.AWAITING_PAYMENT
                elif status == SlotStatus.PREPAID.value:
                    booking_status = BookingStatus.PREPAID
                elif status == SlotStatus.PAID_FULL.value:
                    booking_status = BookingStatus.PAID_FULL
            except ValueError:
                booking_status = BookingStatus.RESERVED
            ts = booked_at or datetime.now().isoformat()
            await db.execute(
                """
                INSERT INTO bookings (
                    slot_id, telegram_user_id, telegram_username, telegram_first_name,
                    telegram_last_name, status, prepayment_amount, total_amount,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                """,
                (slot_id, user_id, username, first_name, last_name, booking_status.value, ts, ts),
            )

    def _row_to_slot(self, row) -> Slot:
        return Slot(
            id=row[0],
            slot_at=parse_stored_datetime(row[1]),
            status=SlotStatus(row[2]),
            user_id=row[3],
            username=row[4],
            first_name=row[5],
            last_name=row[6],
            created_at=parse_stored_datetime(row[7]) if len(row) > 7 and row[7] else None,
            updated_at=parse_stored_datetime(row[8]) if len(row) > 8 and row[8] else None,
        )

    async def _create_booking(
        self,
        db: aiosqlite.Connection,
        slot_id: int,
        user_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
        status: BookingStatus,
        prepayment_amount: int,
        total_amount: int,
    ) -> int:
        now = datetime.now().isoformat()
        cursor = await db.execute(
            """
            INSERT INTO bookings (
                slot_id, telegram_user_id, telegram_username, telegram_first_name,
                telegram_last_name, status, prepayment_amount, total_amount,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                slot_id,
                user_id,
                username,
                first_name,
                last_name,
                status.value,
                prepayment_amount,
                total_amount,
                now,
                now,
            ),
        )
        return cursor.lastrowid

    async def add_slot(self, slot_at: datetime) -> None:
        iso = slot_to_iso(slot_at)
        now = datetime.now().isoformat()
        async with await self._connect() as db:
            try:
                await db.execute(
                    """
                    INSERT INTO slots (slot_at, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (iso, SlotStatus.AVAILABLE.value, now, now),
                )
                await db.commit()
            except aiosqlite.IntegrityError as exc:
                raise ValueError(
                    f"Слот уже существует: {format_slot_datetime(slot_at)}"
                ) from exc

    async def get_slot(self, slot_id: int) -> Slot | None:
        async with await self._connect() as db:
            async with db.execute(
                """
                SELECT id, slot_at, status, user_id, username, first_name, last_name,
                       created_at, updated_at
                FROM slots WHERE id = ?
                """,
                (slot_id,),
            ) as cursor:
                row = await cursor.fetchone()
                return self._row_to_slot(row) if row else None

    async def list_future_slots(self) -> list[Slot]:
        now_iso = now_local_iso()
        async with await self._connect() as db:
            async with db.execute(
                """
                SELECT id, slot_at, status, user_id, username, first_name, last_name,
                       created_at, updated_at
                FROM slots
                WHERE slot_at >= ?
                ORDER BY slot_at
                """,
                (now_iso,),
            ) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_slot(row) for row in rows]

    async def list_available_dates(self) -> list[datetime]:
        now_iso = now_local_iso()
        async with await self._connect() as db:
            async with db.execute(
                """
                SELECT DISTINCT date(slot_at) AS d
                FROM slots
                WHERE status = ? AND slot_at >= ?
                ORDER BY d
                """,
                (SlotStatus.AVAILABLE.value, now_iso),
            ) as cursor:
                rows = await cursor.fetchall()
                return [datetime.fromisoformat(f"{row[0]}T00:00:00") for row in rows]

    async def list_available_times_for_date(self, date: datetime) -> list[Slot]:
        day = date.date().isoformat()
        now_iso = now_local_iso()
        async with await self._connect() as db:
            async with db.execute(
                """
                SELECT id, slot_at, status, user_id, username, first_name, last_name,
                       created_at, updated_at
                FROM slots
                WHERE status = ? AND date(slot_at) = ? AND slot_at >= ?
                ORDER BY slot_at
                """,
                (SlotStatus.AVAILABLE.value, day, now_iso),
            ) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_slot(row) for row in rows]

    async def reserve_slot(
        self,
        slot_id: int,
        user_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
        prepayment_amount: int = 0,
        total_amount: int = 0,
    ) -> Slot:
        now_iso = datetime.now().isoformat()
        async with await self._connect() as db:
            async with db.execute(
                "SELECT status FROM slots WHERE id = ?",
                (slot_id,),
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise ValueError("Слот не найден.")
                if row[0] != SlotStatus.AVAILABLE.value:
                    raise ValueError("Слот уже занят.")

            await db.execute(
                """
                UPDATE slots
                SET status = ?, user_id = ?, username = ?, first_name = ?, last_name = ?,
                    booked_at = ?, updated_at = ?
                WHERE id = ? AND status = ?
                """,
                (
                    SlotStatus.RESERVED.value,
                    user_id,
                    username,
                    first_name,
                    last_name,
                    now_iso,
                    now_iso,
                    slot_id,
                    SlotStatus.AVAILABLE.value,
                ),
            )
            if db.total_changes == 0:
                raise ValueError("Слот уже занят.")

            await self._create_booking(
                db,
                slot_id,
                user_id,
                username,
                first_name,
                last_name,
                BookingStatus.RESERVED,
                prepayment_amount,
                total_amount,
            )
            await db.commit()

        slot = await self.get_slot(slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        return slot

    async def release_slot(self, slot_id: int, user_id: int | None = None) -> Slot:
        now = datetime.now().isoformat()
        async with await self._connect() as db:
            query = "SELECT user_id FROM slots WHERE id = ?"
            async with db.execute(query, (slot_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise ValueError("Слот не найден.")
                if user_id is not None and row[0] != user_id:
                    raise ValueError("Не удалось отменить запись.")

            await db.execute(
                """
                UPDATE slots
                SET status = ?, user_id = NULL, username = NULL, first_name = NULL,
                    last_name = NULL, booked_at = NULL, updated_at = ?
                WHERE id = ?
                """,
                (SlotStatus.AVAILABLE.value, now, slot_id),
            )
            if db.total_changes == 0:
                raise ValueError("Не удалось отменить запись.")

            await db.execute(
                """
                UPDATE bookings
                SET status = ?, updated_at = ?
                WHERE slot_id = ? AND status NOT IN (?, ?)
                """,
                (
                    BookingStatus.CANCELLED.value,
                    now,
                    slot_id,
                    BookingStatus.CANCELLED.value,
                    BookingStatus.PAID_FULL.value,
                ),
            )
            await db.commit()

        slot = await self.get_slot(slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        return slot

    async def mark_awaiting_payment(self, slot_id: int, user_id: int) -> Slot:
        now = datetime.now().isoformat()
        async with await self._connect() as db:
            await db.execute(
                """
                UPDATE slots
                SET status = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND status = ?
                """,
                (
                    SlotStatus.AWAITING_PAYMENT.value,
                    now,
                    slot_id,
                    user_id,
                    SlotStatus.RESERVED.value,
                ),
            )
            if db.total_changes == 0:
                raise ValueError("Запись не найдена или уже обработана.")

            await db.execute(
                """
                UPDATE bookings
                SET status = ?, updated_at = ?
                WHERE slot_id = ? AND telegram_user_id = ? AND status = ?
                """,
                (
                    BookingStatus.AWAITING_PAYMENT.value,
                    now,
                    slot_id,
                    user_id,
                    BookingStatus.RESERVED.value,
                ),
            )
            await db.commit()

        slot = await self.get_slot(slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        return slot

    _ACTIVE_SLOT_STATUSES = (
        SlotStatus.RESERVED.value,
        SlotStatus.AWAITING_PAYMENT.value,
        SlotStatus.PREPAID.value,
    )

    async def get_user_active_slot(self, user_id: int) -> Slot | None:
        now_iso = now_local_iso()
        placeholders = ", ".join("?" for _ in self._ACTIVE_SLOT_STATUSES)
        async with await self._connect() as db:
            async with db.execute(
                f"""
                SELECT id, slot_at, status, user_id, username, first_name, last_name,
                       created_at, updated_at
                FROM slots
                WHERE user_id = ? AND status IN ({placeholders}) AND slot_at >= ?
                ORDER BY slot_at
                LIMIT 1
                """,
                (user_id, *self._ACTIVE_SLOT_STATUSES, now_iso),
            ) as cursor:
                row = await cursor.fetchone()
                return self._row_to_slot(row) if row else None

    async def reschedule_booking(
        self,
        old_slot_id: int,
        new_slot_id: int,
        user_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
    ) -> Slot:
        if old_slot_id == new_slot_id:
            raise ValueError("Выберите другое время.")

        pricing = await self.get_pricing()
        now = datetime.now().isoformat()
        async with await self._connect() as db:
            async with db.execute(
                "SELECT status, user_id FROM slots WHERE id = ?",
                (old_slot_id,),
            ) as cursor:
                old_row = await cursor.fetchone()
            if not old_row or old_row[1] != user_id:
                raise ValueError("Запись не найдена.")
            old_status = old_row[0]
            if old_status not in self._ACTIVE_SLOT_STATUSES:
                raise ValueError("Эту запись нельзя перенести.")

            async with db.execute(
                """
                SELECT prepayment_amount, total_amount FROM bookings
                WHERE slot_id = ? AND status != ?
                ORDER BY updated_at DESC LIMIT 1
                """,
                (old_slot_id, BookingStatus.CANCELLED.value),
            ) as cursor:
                booking_row = await cursor.fetchone()
            prepayment = int(booking_row[0]) if booking_row else pricing.prepay_amount
            total = int(booking_row[1]) if booking_row else pricing.full_price

            async with db.execute(
                "SELECT status FROM slots WHERE id = ?",
                (new_slot_id,),
            ) as cursor:
                new_row = await cursor.fetchone()
            if not new_row:
                raise ValueError("Слот не найден.")
            if new_row[0] != SlotStatus.AVAILABLE.value:
                raise ValueError("Это время уже занято.")

            await db.execute(
                """
                UPDATE slots
                SET status = ?, user_id = NULL, username = NULL, first_name = NULL,
                    last_name = NULL, booked_at = NULL, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (SlotStatus.AVAILABLE.value, now, old_slot_id, user_id),
            )
            await db.execute(
                """
                UPDATE bookings
                SET status = ?, updated_at = ?
                WHERE slot_id = ? AND status != ?
                """,
                (BookingStatus.CANCELLED.value, now, old_slot_id, BookingStatus.CANCELLED.value),
            )

            new_slot_status = SlotStatus.RESERVED.value
            if old_status == SlotStatus.AWAITING_PAYMENT.value:
                new_slot_status = SlotStatus.AWAITING_PAYMENT.value
            elif old_status == SlotStatus.PREPAID.value:
                new_slot_status = SlotStatus.PREPAID.value

            await db.execute(
                """
                UPDATE slots
                SET status = ?, user_id = ?, username = ?, first_name = ?, last_name = ?,
                    booked_at = ?, updated_at = ?
                WHERE id = ? AND status = ?
                """,
                (
                    new_slot_status,
                    user_id,
                    username,
                    first_name,
                    last_name,
                    now,
                    now,
                    new_slot_id,
                    SlotStatus.AVAILABLE.value,
                ),
            )
            if db.total_changes == 0:
                raise ValueError("Не удалось забронировать новое время.")

            booking_status = BookingStatus.RESERVED
            if new_slot_status == SlotStatus.AWAITING_PAYMENT.value:
                booking_status = BookingStatus.AWAITING_PAYMENT
            elif new_slot_status == SlotStatus.PREPAID.value:
                booking_status = BookingStatus.PREPAID

            await self._create_booking(
                db,
                new_slot_id,
                user_id,
                username,
                first_name,
                last_name,
                booking_status,
                prepayment,
                total,
            )
            await db.commit()

        slot = await self.get_slot(new_slot_id)
        if not slot:
            raise ValueError("Слот не найден.")
        return slot

    async def delete_slot(self, slot_id: int) -> None:
        async with await self._connect() as db:
            async with db.execute(
                "SELECT status FROM slots WHERE id = ?",
                (slot_id,),
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    raise ValueError("Слот не найден.")
                if row[0] != SlotStatus.AVAILABLE.value:
                    raise ValueError("Нельзя удалить занятый слот.")

            await db.execute("DELETE FROM slots WHERE id = ?", (slot_id,))
            await db.commit()

    async def list_awaiting_payment(self) -> list[Slot]:
        now_iso = now_local_iso()
        async with await self._connect() as db:
            async with db.execute(
                """
                SELECT id, slot_at, status, user_id, username, first_name, last_name,
                       created_at, updated_at
                FROM slots
                WHERE status = ? AND slot_at >= ?
                ORDER BY slot_at
                """,
                (SlotStatus.AWAITING_PAYMENT.value, now_iso),
            ) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_slot(row) for row in rows]

    async def parse_and_add_slots(self, text: str) -> tuple[int, list[str]]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        added = 0
        errors: list[str] = []
        for line in lines:
            try:
                slot_at = parse_slot_datetime(line)
                if slot_at <= datetime.now():
                    raise ValueError("Дата и время должны быть в будущем.")
                await self.add_slot(slot_at)
                added += 1
            except ValueError as exc:
                errors.append(f"{line}: {exc}")
        return added, errors
