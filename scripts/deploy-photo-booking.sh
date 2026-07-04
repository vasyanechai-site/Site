#!/usr/bin/env bash
# One-shot deploy: push to GitHub + trigger VPS/FTP workflows.
# Run from repo root: bash scripts/deploy-photo-booking.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Commit or stash uncommitted changes first."
  exit 1
fi

echo "==> Pushing main..."
git push origin main

echo "==> Triggering GitHub Actions workflows..."
gh workflow run deploy-photo-booking-bot.yml -R vasyanechai-site/Site
gh workflow run deploy-reg-vps.yml -R vasyanechai-site/Site
gh workflow run deploy-reg-ftp.yml -R vasyanechai-site/Site

echo "Done. Watch: https://github.com/vasyanechai-site/Site/actions"
echo "Bot logs on VPS: pm2 logs photo-booking-bot"
