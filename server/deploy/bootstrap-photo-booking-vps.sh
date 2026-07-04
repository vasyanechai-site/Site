#!/usr/bin/env bash
# Run ON VPS once (or via SSH) to bootstrap photo-booking-bot .env and PM2.
# Usage on VPS:
#   cd /var/www/site   # your VPS_APP_PATH
#   bash server/deploy/bootstrap-photo-booking-vps.sh
set -euo pipefail

APP_PATH="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_PATH"

BOT_ENV="$APP_PATH/photo-booking-bot/.env"

if [ ! -f "$BOT_ENV" ]; then
  cp photo-booking-bot/.env.example "$BOT_ENV"
  echo "Created $BOT_ENV — edit BOT_TOKEN and other values, then re-run."
  exit 1
fi

if ! grep -q '^BOT_TOKEN=.\+' "$BOT_ENV"; then
  echo "Set BOT_TOKEN in $BOT_ENV first."
  exit 1
fi

cd photo-booking-bot
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -q -r requirements.txt
cd "$APP_PATH"

npm ci --omit=dev

pm2 delete photo-booking-bot 2>/dev/null || true
pm2 delete site-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "PM2 status:"
pm2 status

echo "Bot logs:"
pm2 logs photo-booking-bot --lines 20 --nostream
