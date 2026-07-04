#!/usr/bin/env python3
"""Проверка CLOSED_CHANNEL_ID: канал существует, бот — админ с правом invite."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aiogram import Bot  # noqa: E402
from aiogram.client.session.aiohttp import AiohttpSession  # noqa: E402
from aiogram.client.telegram import TelegramAPIServer  # noqa: E402

from bot.channel_setup import channel_id_env_hint, inspect_closed_channel  # noqa: E402
from bot.config import load_settings  # noqa: E402


def build_bot(settings) -> Bot:
    if settings.telegram_api_base:
        session = AiohttpSession(api=TelegramAPIServer.from_base(settings.telegram_api_base))
        return Bot(token=settings.bot_token, session=session)
    return Bot(token=settings.bot_token)


async def main() -> int:
    settings = load_settings()
    bot = build_bot(settings)
    try:
        info = await inspect_closed_channel(bot, settings)
        print(json.dumps(info, ensure_ascii=False, indent=2, default=str))
        if info.get("ok"):
            print(
                f"\nOK — CLOSED_CHANNEL_ID={channel_id_env_hint(info['chat_id'])} "
                f"({info.get('title')})"
            )
            return 0
        print("\nFAIL — исправьте CLOSED_CHANNEL_ID и права бота в канале")
        return 1
    finally:
        await bot.session.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
