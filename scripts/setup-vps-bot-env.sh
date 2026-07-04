#!/usr/bin/env bash
# Create photo-booking-bot/.env on VPS from local photo-booking-bot/.env (one-time helper).
# Usage: bash scripts/setup-vps-bot-env.sh user@your-vps /var/www/site
set -euo pipefail

SSH_TARGET="${1:?Usage: $0 user@host /path/to/site}"
APP_PATH="${2:?Usage: $0 user@host /path/to/site}"
LOCAL_ENV="$(cd "$(dirname "$0")/.." && pwd)/photo-booking-bot/.env"

if [ ! -f "$LOCAL_ENV" ]; then
  echo "Missing $LOCAL_ENV — create it locally first."
  exit 1
fi

scp "$LOCAL_ENV" "${SSH_TARGET}:${APP_PATH}/photo-booking-bot/.env"
echo "Uploaded .env to ${SSH_TARGET}:${APP_PATH}/photo-booking-bot/.env"
echo "Now re-run GitHub Action: Deploy to Reg VPS (or Deploy photo booking bot)"
