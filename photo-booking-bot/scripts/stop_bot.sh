#!/usr/bin/env bash
# Остановить все экземпляры photo-booking-bot на VPS (один polling на токен).
set -euo pipefail

APP_ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
LOCK="${APP_ROOT}/photo-booking-bot/data/.bot.lock"

echo "[stop_bot] pm2 delete photo-booking-bot"
pm2 delete photo-booking-bot 2>/dev/null || true

echo "[stop_bot] kill stray python -m bot"
pkill -f '[.]venv/bin/python -m bot' 2>/dev/null || true
pkill -f 'photo-booking-bot/.venv/bin/python -m bot' 2>/dev/null || true
sleep 2
pkill -9 -f '[.]venv/bin/python -m bot' 2>/dev/null || true

rm -f "$LOCK"
echo "[stop_bot] lock removed: $LOCK"
pm2 status photo-booking-bot 2>/dev/null || echo "[stop_bot] no pm2 process"
