#!/usr/bin/env bash
# Обновляет переменные relay на Vercel из GitHub Actions (если секрет задан — иначе пропуск).
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN не задан}"

upsert() {
  local name="$1"
  local val="${2:-}"
  if [[ -z "$val" ]]; then
    echo "[vercel-sync] пропуск $name (пустой секрет в GitHub — оставляем как в Vercel)"
    return 0
  fi
  vercel --token "$VERCEL_TOKEN" env rm "$name" production -y 2>/dev/null || true
  printf '%s' "$val" | vercel --token "$VERCEL_TOKEN" env add "$name" production --force --sensitive
  echo "[vercel-sync] ok $name"
}

upsert TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
upsert TELEGRAM_CHAT_ID "${TELEGRAM_CHAT_ID:-}"
upsert TELEGRAM_RELAY_SECRET "${TELEGRAM_RELAY_SECRET:-}"
