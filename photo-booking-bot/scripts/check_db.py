#!/usr/bin/env python3
"""Проверка БД бронирования на VPS (запускается после деплоя)."""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bot.config import load_settings  # noqa: E402


def main() -> int:
    settings = load_settings()
    path = settings.database_path
    print(f"[check_db] path={path}")
    if not path.is_file():
        print("[check_db] WARNING: database file missing")
        return 0

    size = path.stat().st_size
    print(f"[check_db] exists=True size={size}")

    conn = sqlite3.connect(path)
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        print(f"[check_db] tables={sorted(tables)}")
        if "slots" not in tables:
            print("[check_db] WARNING: no slots table")
            return 0

        total = conn.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
        available = conn.execute(
            "SELECT COUNT(*) FROM slots WHERE status='available'"
        ).fetchone()[0]
        print(f"[check_db] total_slots={total} available={available}")

        rows = conn.execute(
            "SELECT slot_at, status FROM slots WHERE status='available' ORDER BY slot_at LIMIT 10"
        ).fetchall()
        for slot_at, status in rows:
            print(f"[check_db] slot {slot_at} ({status})")

        if available == 0:
            print("[check_db] WARNING: zero available slots in bot database")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    env_path = os.getenv("DATABASE_PATH", "")
    if env_path:
        print(f"[check_db] env DATABASE_PATH={env_path}")
    raise SystemExit(main())
