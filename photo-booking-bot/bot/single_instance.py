"""Гарантия одного процесса polling на VPS (иначе TelegramConflictError)."""
from __future__ import annotations

import fcntl
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_lock_handle = None


def acquire_single_instance_lock(data_dir: Path) -> None:
    """Блокировка файла; второй процесс завершается с кодом 1."""
    global _lock_handle
    data_dir.mkdir(parents=True, exist_ok=True)
    lock_path = data_dir / ".bot.lock"
    handle = open(lock_path, "w", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        try:
            other_pid = lock_path.read_text(encoding="utf-8").strip()
        except OSError:
            other_pid = "?"
        logger.error(
            "Another photo-booking-bot is already running (pid %s, lock %s). "
            "Stop duplicate: pm2 delete photo-booking-bot; pkill -f 'python -m bot'",
            other_pid,
            lock_path,
        )
        raise SystemExit(1) from None

    handle.seek(0)
    handle.truncate()
    handle.write(str(os.getpid()))
    handle.flush()
    _lock_handle = handle
    logger.info("Single-instance lock acquired (pid %s)", os.getpid())
