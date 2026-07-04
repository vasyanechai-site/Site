"""Channel subscription DB layer (mixin for Database)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from bot.channel_utils import (
    INVITE_EXPIRE_HOURS,
    SUBSCRIPTION_PERIOD_DAYS,
    InviteLinkStatus,
    SubscriptionStatus,
)
from bot.utils import now_local_dt, now_local_iso, parse_stored_datetime


@dataclass
class ChannelSettings:
    monthly_price: int


@dataclass
class ChannelSubscription:
    id: int
    telegram_user_id: int
    telegram_username: str | None
    telegram_first_name: str | None
    telegram_last_name: str | None
    status: SubscriptionStatus
    amount: int
    paid_at: datetime | None
    starts_at: datetime | None
    ends_at: datetime | None
    joined_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass
class ChannelInviteLink:
    id: int
    subscription_id: int
    telegram_user_id: int
    invite_link: str
    status: InviteLinkStatus
    expected_user_id: int
    used_by_user_id: int | None
    created_at: datetime
    used_at: datetime | None
    expires_at: datetime


class ChannelDbMixin:
    async def _init_channel_schema(self, db) -> None:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS channel_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_user_id INTEGER NOT NULL,
                telegram_username TEXT,
                telegram_first_name TEXT,
                telegram_last_name TEXT,
                status TEXT NOT NULL DEFAULT 'pending_payment',
                amount INTEGER NOT NULL DEFAULT 500,
                paid_at TEXT,
                starts_at TEXT,
                ends_at TEXT,
                joined_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS channel_invite_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subscription_id INTEGER NOT NULL,
                telegram_user_id INTEGER NOT NULL,
                invite_link TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                expected_user_id INTEGER NOT NULL,
                used_by_user_id INTEGER,
                created_at TEXT NOT NULL,
                used_at TEXT,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (subscription_id) REFERENCES channel_subscriptions(id)
            )
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_ch_sub_user ON channel_subscriptions(telegram_user_id)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_ch_sub_status ON channel_subscriptions(status)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_ch_invite_link ON channel_invite_links(invite_link)"
        )
        async with db.execute("PRAGMA table_info(app_settings)") as cursor:
            columns = {row[1] for row in await cursor.fetchall()}
        if "channel_monthly_price" not in columns:
            await db.execute(
                "ALTER TABLE app_settings ADD COLUMN channel_monthly_price INTEGER DEFAULT 500"
            )

    def _row_to_subscription(self, row) -> ChannelSubscription:
        return ChannelSubscription(
            id=row[0],
            telegram_user_id=row[1],
            telegram_username=row[2],
            telegram_first_name=row[3],
            telegram_last_name=row[4],
            status=SubscriptionStatus(row[5]),
            amount=int(row[6]),
            paid_at=parse_stored_datetime(row[7]) if row[7] else None,
            starts_at=parse_stored_datetime(row[8]) if row[8] else None,
            ends_at=parse_stored_datetime(row[9]) if row[9] else None,
            joined_at=parse_stored_datetime(row[10]) if row[10] else None,
            created_at=parse_stored_datetime(row[11]),
            updated_at=parse_stored_datetime(row[12]),
        )

    def _row_to_invite(self, row) -> ChannelInviteLink:
        return ChannelInviteLink(
            id=row[0],
            subscription_id=row[1],
            telegram_user_id=row[2],
            invite_link=row[3],
            status=InviteLinkStatus(row[4]),
            expected_user_id=row[5],
            used_by_user_id=row[6],
            created_at=parse_stored_datetime(row[7]),
            used_at=parse_stored_datetime(row[8]) if row[8] else None,
            expires_at=parse_stored_datetime(row[9]),
        )

    async def get_channel_settings(self) -> ChannelSettings:
        async with self._connect() as db:
            async with db.execute(
                "SELECT channel_monthly_price FROM app_settings WHERE id = 1"
            ) as cursor:
                row = await cursor.fetchone()
        price = int(row[0]) if row and row[0] is not None else 500
        return ChannelSettings(monthly_price=price)

    async def update_channel_price(self, monthly_price: int) -> ChannelSettings:
        if monthly_price <= 0:
            raise ValueError("Стоимость должна быть положительной")
        now = now_local_iso()
        async with self._connect() as db:
            await db.execute(
                "UPDATE app_settings SET channel_monthly_price = ?, updated_at = ? WHERE id = 1",
                (monthly_price, now),
            )
            await db.commit()
        return await self.get_channel_settings()

    async def expire_channel_subscriptions(self) -> None:
        now = now_local_iso()
        async with self._connect() as db:
            await db.execute(
                """
                UPDATE channel_subscriptions
                SET status = ?, updated_at = ?
                WHERE status = ? AND ends_at IS NOT NULL AND ends_at < ?
                """,
                (SubscriptionStatus.EXPIRED.value, now, SubscriptionStatus.ACTIVE.value, now),
            )
            await db.commit()

    async def get_user_channel_subscription(
        self, telegram_user_id: int
    ) -> ChannelSubscription | None:
        await self.expire_channel_subscriptions()
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, telegram_user_id, telegram_username, telegram_first_name,
                       telegram_last_name, status, amount, paid_at, starts_at, ends_at,
                       joined_at, created_at, updated_at
                FROM channel_subscriptions
                WHERE telegram_user_id = ?
                ORDER BY id DESC LIMIT 1
                """,
                (telegram_user_id,),
            ) as cursor:
                row = await cursor.fetchone()
        return self._row_to_subscription(row) if row else None

    def subscription_is_active(self, sub: ChannelSubscription) -> bool:
        if sub.status != SubscriptionStatus.ACTIVE:
            return False
        if sub.ends_at and sub.ends_at < now_local_dt():
            return False
        return True

    async def ensure_pending_subscription(
        self,
        *,
        telegram_user_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
        amount: int,
    ) -> ChannelSubscription:
        sub = await self.get_user_channel_subscription(telegram_user_id)
        now = now_local_iso()
        if sub and sub.status == SubscriptionStatus.PENDING_PAYMENT:
            return sub
        if sub and self.subscription_is_active(sub):
            return sub
        async with self._connect() as db:
            await db.execute(
                """
                INSERT INTO channel_subscriptions (
                    telegram_user_id, telegram_username, telegram_first_name,
                    telegram_last_name, status, amount, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    telegram_user_id,
                    username,
                    first_name,
                    last_name,
                    SubscriptionStatus.PENDING_PAYMENT.value,
                    amount,
                    now,
                    now,
                ),
            )
            await db.commit()
            async with db.execute("SELECT last_insert_rowid()") as cursor:
                sub_id = (await cursor.fetchone())[0]
        return await self.get_channel_subscription_by_id(sub_id)

    async def get_channel_subscription_by_id(self, sub_id: int) -> ChannelSubscription:
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, telegram_user_id, telegram_username, telegram_first_name,
                       telegram_last_name, status, amount, paid_at, starts_at, ends_at,
                       joined_at, created_at, updated_at
                FROM channel_subscriptions WHERE id = ?
                """,
                (sub_id,),
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            raise ValueError("Подписка не найдена")
        return self._row_to_subscription(row)

    async def confirm_channel_payment(
        self,
        subscription_id: int,
        *,
        extend: bool = False,
    ) -> ChannelSubscription:
        sub = await self.get_channel_subscription_by_id(subscription_id)
        now_dt = now_local_dt()
        now = now_dt.isoformat()
        if extend and sub.ends_at and sub.ends_at > now_dt:
            starts = sub.starts_at or now_dt
            ends = sub.ends_at + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        else:
            starts = now_dt
            ends = now_dt + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        async with self._connect() as db:
            await db.execute(
                """
                UPDATE channel_subscriptions
                SET status = ?, paid_at = ?, starts_at = ?, ends_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    SubscriptionStatus.ACTIVE.value,
                    now,
                    starts.isoformat(),
                    ends.isoformat(),
                    now,
                    subscription_id,
                ),
            )
            await db.commit()
        return await self.get_channel_subscription_by_id(subscription_id)

    async def cancel_channel_subscription(self, subscription_id: int) -> ChannelSubscription:
        now = now_local_iso()
        async with self._connect() as db:
            await db.execute(
                """
                UPDATE channel_subscriptions SET status = ?, updated_at = ? WHERE id = ?
                """,
                (SubscriptionStatus.CANCELLED.value, now, subscription_id),
            )
            await db.execute(
                """
                UPDATE channel_invite_links SET status = ?, used_at = COALESCE(used_at, ?)
                WHERE subscription_id = ? AND status = ?
                """,
                (InviteLinkStatus.REVOKED.value, now, subscription_id, InviteLinkStatus.PENDING.value),
            )
            await db.commit()
        return await self.get_channel_subscription_by_id(subscription_id)

    async def activate_channel_subscription_manual(self, subscription_id: int) -> ChannelSubscription:
        return await self.confirm_channel_payment(subscription_id, extend=False)

    async def save_invite_link(
        self,
        *,
        subscription_id: int,
        telegram_user_id: int,
        invite_link: str,
        expected_user_id: int,
        expires_at: datetime,
    ) -> ChannelInviteLink:
        now = now_local_iso()
        async with self._connect() as db:
            await db.execute(
                """
                UPDATE channel_invite_links SET status = ?, used_at = ?
                WHERE subscription_id = ? AND status = ?
                """,
                (InviteLinkStatus.REVOKED.value, now, subscription_id, InviteLinkStatus.PENDING.value),
            )
            await db.execute(
                """
                INSERT INTO channel_invite_links (
                    subscription_id, telegram_user_id, invite_link, status,
                    expected_user_id, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subscription_id,
                    telegram_user_id,
                    invite_link,
                    InviteLinkStatus.PENDING.value,
                    expected_user_id,
                    now,
                    expires_at.isoformat(),
                ),
            )
            await db.commit()
            async with db.execute("SELECT last_insert_rowid()") as cursor:
                link_id = (await cursor.fetchone())[0]
        return await self.get_invite_link_by_id(link_id)

    async def get_invite_link_by_id(self, link_id: int) -> ChannelInviteLink:
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, subscription_id, telegram_user_id, invite_link, status,
                       expected_user_id, used_by_user_id, created_at, used_at, expires_at
                FROM channel_invite_links WHERE id = ?
                """,
                (link_id,),
            ) as cursor:
                row = await cursor.fetchone()
        if not row:
            raise ValueError("Invite-ссылка не найдена")
        return self._row_to_invite(row)

    async def get_invite_by_url(self, invite_link: str) -> ChannelInviteLink | None:
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, subscription_id, telegram_user_id, invite_link, status,
                       expected_user_id, used_by_user_id, created_at, used_at, expires_at
                FROM channel_invite_links WHERE invite_link = ?
                ORDER BY id DESC LIMIT 1
                """,
                (invite_link,),
            ) as cursor:
                row = await cursor.fetchone()
        return self._row_to_invite(row) if row else None

    async def get_pending_invite_for_user(
        self, telegram_user_id: int
    ) -> ChannelInviteLink | None:
        now = now_local_iso()
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, subscription_id, telegram_user_id, invite_link, status,
                       expected_user_id, used_by_user_id, created_at, used_at, expires_at
                FROM channel_invite_links
                WHERE telegram_user_id = ? AND status = ? AND expires_at > ?
                ORDER BY id DESC LIMIT 1
                """,
                (telegram_user_id, InviteLinkStatus.PENDING.value, now),
            ) as cursor:
                row = await cursor.fetchone()
        return self._row_to_invite(row) if row else None

    async def mark_invite_used(
        self,
        link_id: int,
        *,
        used_by_user_id: int,
        ok: bool,
    ) -> ChannelInviteLink:
        now = now_local_iso()
        status = InviteLinkStatus.USED_OK if ok else InviteLinkStatus.USED_WRONG_USER
        async with self._connect() as db:
            await db.execute(
                """
                UPDATE channel_invite_links
                SET status = ?, used_by_user_id = ?, used_at = ?
                WHERE id = ?
                """,
                (status.value, used_by_user_id, now, link_id),
            )
            if ok:
                await db.execute(
                    """
                    UPDATE channel_subscriptions
                    SET joined_at = ?, updated_at = ?
                    WHERE id = (
                        SELECT subscription_id FROM channel_invite_links WHERE id = ?
                    )
                    """,
                    (now, now, link_id),
                )
            await db.commit()
        return await self.get_invite_link_by_id(link_id)

    async def list_channel_subscriptions(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        limit: int = 500,
    ) -> list[ChannelSubscription]:
        await self.expire_channel_subscriptions()
        clauses: list[str] = []
        params: list = []
        if status:
            clauses.append("status = ?")
            params.append(status)
        if search:
            q = f"%{search.strip().lower()}%"
            clauses.append(
                "(LOWER(COALESCE(telegram_username,'')) LIKE ? OR "
                "LOWER(COALESCE(telegram_first_name,'')) LIKE ? OR "
                "CAST(telegram_user_id AS TEXT) LIKE ?)"
            )
            params.extend([q, q, q])
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        async with self._connect() as db:
            async with db.execute(
                f"""
                SELECT id, telegram_user_id, telegram_username, telegram_first_name,
                       telegram_last_name, status, amount, paid_at, starts_at, ends_at,
                       joined_at, created_at, updated_at
                FROM channel_subscriptions {where}
                ORDER BY id DESC LIMIT ?
                """,
                (*params, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        return [self._row_to_subscription(r) for r in rows]

    async def get_latest_invite_for_subscription(
        self, subscription_id: int
    ) -> ChannelInviteLink | None:
        async with self._connect() as db:
            async with db.execute(
                """
                SELECT id, subscription_id, telegram_user_id, invite_link, status,
                       expected_user_id, used_by_user_id, created_at, used_at, expires_at
                FROM channel_invite_links WHERE subscription_id = ?
                ORDER BY id DESC LIMIT 1
                """,
                (subscription_id,),
            ) as cursor:
                row = await cursor.fetchone()
        return self._row_to_invite(row) if row else None

    async def get_channel_stats(self) -> dict:
        await self.expire_channel_subscriptions()
        now = now_local_dt()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = (now - timedelta(days=30)).isoformat()

        async with self._connect() as db:
            async def scalar(sql: str, params=()):
                async with db.execute(sql, params) as cur:
                    row = await cur.fetchone()
                    return int(row[0]) if row else 0

            total_paid = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE paid_at IS NOT NULL"
            )
            active = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE status = ?",
                (SubscriptionStatus.ACTIVE.value,),
            )
            joined = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE joined_at IS NOT NULL"
            )
            paid_not_joined = await scalar(
                """
                SELECT COUNT(*) FROM channel_subscriptions
                WHERE status = ? AND paid_at IS NOT NULL AND joined_at IS NULL
                """,
                (SubscriptionStatus.ACTIVE.value,),
            )
            expired = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE status = ?",
                (SubscriptionStatus.EXPIRED.value,),
            )
            cancelled = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE status = ?",
                (SubscriptionStatus.CANCELLED.value,),
            )
            new_today = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE paid_at >= ?",
                (today_start,),
            )
            new_week = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE paid_at >= ?",
                (week_start,),
            )
            new_month = await scalar(
                "SELECT COUNT(*) FROM channel_subscriptions WHERE paid_at >= ?",
                (month_start,),
            )

            async def revenue(since: str | None) -> int:
                if since:
                    q = "SELECT COALESCE(SUM(amount),0) FROM channel_subscriptions WHERE paid_at >= ?"
                    p = (since,)
                else:
                    q = "SELECT COALESCE(SUM(amount),0) FROM channel_subscriptions WHERE paid_at IS NOT NULL"
                    p = ()
                async with db.execute(q, p) as cur:
                    row = await cur.fetchone()
                    return int(row[0]) if row else 0

            rev_today = await revenue(today_start)
            rev_week = await revenue(week_start)
            rev_month = await revenue(month_start)
            rev_total = await revenue(None)

            async with db.execute(
                """
                SELECT paid_at FROM channel_subscriptions
                WHERE paid_at IS NOT NULL ORDER BY paid_at DESC LIMIT 1
                """
            ) as cur:
                last_pay = (await cur.fetchone())
            async with db.execute(
                """
                SELECT joined_at FROM channel_subscriptions
                WHERE joined_at IS NOT NULL ORDER BY joined_at DESC LIMIT 1
                """
            ) as cur:
                last_join = (await cur.fetchone())

        return {
            "totalPaid": total_paid,
            "active": active,
            "joined": joined,
            "paidNotJoined": paid_not_joined,
            "expired": expired,
            "cancelled": cancelled,
            "newToday": new_today,
            "newWeek": new_week,
            "newMonth": new_month,
            "revenueToday": rev_today,
            "revenueWeek": rev_week,
            "revenueMonth": rev_month,
            "revenueTotal": rev_total,
            "lastPaymentAt": last_pay[0] if last_pay else None,
            "lastJoinAt": last_join[0] if last_join else None,
        }
