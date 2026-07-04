#!/usr/bin/env python3
"""Полная проверка бота: БД + Telegram API через relay (тот же aiohttp, что aiogram)."""
from __future__ import annotations

import asyncio
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bot.config import load_settings  # noqa: E402


def check_db(path: Path) -> dict:
    result = {"path": str(path), "exists": path.is_file(), "total": 0, "available": 0, "slots": []}
    if not path.is_file():
        result["error"] = "database missing"
        return result
    result["size"] = path.stat().st_size
    conn = sqlite3.connect(path)
    try:
        result["total"] = conn.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
        result["available"] = conn.execute(
            "SELECT COUNT(*) FROM slots WHERE status='available'"
        ).fetchone()[0]
        result["slots"] = [
            {"slot_at": r[0], "status": r[1]}
            for r in conn.execute(
                "SELECT slot_at, status FROM slots ORDER BY slot_at LIMIT 20"
            ).fetchall()
        ]
    finally:
        conn.close()
    return result


async def check_telegram(settings) -> dict:
    """Проверка через aiogram/aiohttp — urllib блокируется Cloudflare (1010) с VPS."""
    from aiogram import Bot
    from aiogram.client.session.aiohttp import AiohttpSession
    from aiogram.client.telegram import TelegramAPIServer

    base = (
        settings.telegram_api_base.rsplit("/", 1)[0]
        if settings.telegram_api_base
        else ""
    )
    result = {"proxy_url": base, "ok": False}
    if not settings.telegram_api_base:
        result["error"] = "telegram_api_base not configured"
        return result
    if "telegram-bot-proxy" in base or "<" in base:
        result["error"] = f"invalid proxy host (use telegram-relay): {base}"
        return result

    session = AiohttpSession(
        api=TelegramAPIServer.from_base(settings.telegram_api_base),
    )
    bot = Bot(token=settings.bot_token, session=session)
    try:
        me = await bot.get_me()
        result["ok"] = True
        result["username"] = me.username
    except Exception as exc:
        result["error"] = str(exc)
    finally:
        await bot.session.close()
    return result


async def check_bot_db_methods(path: Path) -> dict:
    from bot.database import Database  # noqa: E402

    db = Database(path)
    await db.init()
    available = await db.count_available_future_slots()
    dates = await db.list_available_dates()
    return {"available_future": available, "dates_count": len(dates)}


async def run_checks() -> int:
    settings = load_settings()
    print("[healthcheck] === Photo booking bot healthcheck ===")

    db_info = check_db(settings.database_path)
    print(f"[healthcheck] db.path={db_info['path']}")
    print(f"[healthcheck] db.available={db_info.get('available', 0)} total={db_info.get('total', 0)}")
    for slot in db_info.get("slots", []):
        print(f"[healthcheck] db.slot {slot['slot_at']} ({slot['status']})")

    bot_methods = await check_bot_db_methods(settings.database_path)
    print(
        f"[healthcheck] bot.list_available_dates={bot_methods['dates_count']} "
        f"count_available_future={bot_methods['available_future']}"
    )

    tg = await check_telegram(settings)
    print(f"[healthcheck] telegram.proxy={tg.get('proxy_url')}")
    print(f"[healthcheck] telegram.ok={tg.get('ok')} username={tg.get('username', '-')}")
    if tg.get("error"):
        print(f"[healthcheck] telegram.error={tg['error']}")

    failed = False
    if not db_info.get("exists"):
        print("[healthcheck] FAIL: database file missing")
        failed = True
    if bot_methods["dates_count"] == 0 and db_info.get("available", 0) > 0:
        print("[healthcheck] FAIL: bot query returns 0 dates but DB has slots")
        failed = True
    if not tg.get("ok"):
        print("[healthcheck] FAIL: Telegram API not reachable via relay")
        failed = True
    if db_info.get("available", 0) == 0:
        print("[healthcheck] WARN: no available slots — add slots in /anna admin")

    if failed:
        return 1
    print("[healthcheck] OK — bot should show slots in Telegram")
    return 0


def main() -> int:
    return asyncio.run(run_checks())


if __name__ == "__main__":
    raise SystemExit(main())
