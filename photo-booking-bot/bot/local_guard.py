"""Блокировка случайного локального polling с прод-токеном (конфликт с VPS)."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Маркеры dev-машины — не VPS (/home/ubuntu/... на сервере допустим)
_LOCAL_MARKERS = ("/Users/", "Sites/Site", "Sites\\Site", "\\Users\\")


def refuse_accidental_local_polling(database_path: Path) -> None:
    """
    На VPS DATABASE_PATH абсолютный (/var/www/..., /home/ubuntu/...).
    Локально без DATABASE_PATH — data/booking.db под ~/Sites/Site.
    """
    if os.getenv("ALLOW_LOCAL_BOT", "").strip() in ("1", "true", "yes"):
        return

    db = str(database_path.resolve())
    is_likely_local = any(m in db for m in _LOCAL_MARKERS) or not db.startswith("/")

    if is_likely_local:
        logger.error(
            "Локальный запуск бота с прод-токеном заблокирован — на VPS уже работает PM2.\n"
            "Это вызывает TelegramConflictError.\n\n"
            "Остановите этот процесс (Ctrl+C в терминале с python -m bot).\n"
            "Для осознанной локальной отладки: ALLOW_LOCAL_BOT=1 в .env и stop_bot на VPS."
        )
        raise SystemExit(1)
