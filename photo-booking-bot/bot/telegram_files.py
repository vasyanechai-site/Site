"""Download Telegram files directly from api.telegram.org (bypass relay /file/ 405)."""

from __future__ import annotations

import logging

import aiohttp

from bot.config import Settings

logger = logging.getLogger(__name__)


async def download_telegram_file(
    settings: Settings,
    file_path: str,
    *,
    timeout_sec: int = 25,
) -> bytes:
    url = f"https://api.telegram.org/file/bot{settings.bot_token}/{file_path}"
    proxy = settings.https_proxy
    timeout = aiohttp.ClientTimeout(total=timeout_sec, connect=10)

    logger.info("Downloading Telegram file via api.telegram.org (proxy=%s)", bool(proxy))
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url, proxy=proxy) as resp:
            if resp.status != 200:
                snippet = (await resp.text())[:200]
                raise RuntimeError(f"HTTP {resp.status} при скачивании файла: {snippet}")
            data = await resp.read()

    if not data:
        raise ValueError("Пустой файл")
    return data
