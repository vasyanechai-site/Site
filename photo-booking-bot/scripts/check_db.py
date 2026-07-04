#!/usr/bin/env python3
"""Проверка БД бронирования на VPS (запускается после деплоя)."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bot.config import load_settings  # noqa: E402
from bot.database import Database  # noqa: E402


async def main() -> int:
    settings = load_settings()
    path = settings.database_path
    print(f"[check_db] path={path}")
    print(f"[check_db] exists={path.is_file()} size={path.stat().st_size if path.is_file() else 0}")

    db = Database(path)
    await db.init()
    available = await db.count_available_future_slots()
    dates = await db.list_available_dates()
    print(f"[check_db] available_future_slots={available}")
    print(f"[check_db] available_dates={len(dates)}")

    if path.is_file():
        import sqlite3

        conn = sqlite3.connect(path)
        rows = conn.execute(
            "SELECT slot_at, status FROM slots WHERE status='available' ORDER BY slot_at LIMIT 10"
        ).fetchall()
        conn.close()
        for slot_at, status in rows:
            print(f"[check_db] slot {slot_at} ({status})")

    if available == 0:
        print("[check_db] WARNING: bot sees zero available slots")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
