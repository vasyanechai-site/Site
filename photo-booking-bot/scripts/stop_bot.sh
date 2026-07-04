#!/usr/bin/env bash
# Остановить все экземпляры photo-booking-bot на VPS (один polling на токен).
set -euo pipefail

APP_ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
LOCK="${APP_ROOT}/photo-booking-bot/data/.bot.lock"

echo "[stop_bot] pm2 stop/delete photo-booking-bot"
pm2 stop photo-booking-bot 2>/dev/null || true
sleep 2
pm2 delete photo-booking-bot 2>/dev/null || true

echo "[stop_bot] kill stray bot processes"
pkill -f '[.]venv/bin/python -m bot' 2>/dev/null || true
pkill -f 'photo-booking-bot/.venv/bin/python -m bot' 2>/dev/null || true
pkill -f 'python3 -m bot' 2>/dev/null || true
pkill -f 'python -m bot' 2>/dev/null || true
sleep 3
pkill -9 -f 'python.*-m bot' 2>/dev/null || true

rm -f "$LOCK"
echo "[stop_bot] lock removed: $LOCK"
sleep 2
pgrep -af 'python.*-m bot' 2>/dev/null && echo "[stop_bot] WARNING: bot process still running" || echo "[stop_bot] no stray bot processes"
