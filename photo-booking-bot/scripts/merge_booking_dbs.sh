#!/usr/bin/env bash
# Находит все booking.db на VPS и сливает слоты в канонический файл.
set -euo pipefail

APP_ROOT="${1:?usage: merge_booking_dbs.sh APP_ROOT}"
CANON="${APP_ROOT}/photo-booking-bot/data/booking.db"

mkdir -p "$(dirname "$CANON")"
echo "[merge_db] canonical=$CANON"

if ! command -v sqlite3 >/dev/null; then
  echo "[merge_db] sqlite3 not installed — skip merge"
  exit 0
fi

# Схема на случай пустого файла (совместимо с API/ботом)
sqlite3 "$CANON" <<'SQL'
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_at TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available',
  user_id INTEGER,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  booked_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL,
  telegram_user_id INTEGER NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  status TEXT NOT NULL,
  prepayment_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  admin_comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_price INTEGER NOT NULL DEFAULT 3000,
  prepay_percent INTEGER NOT NULL DEFAULT 50,
  updated_at TEXT
);
INSERT OR IGNORE INTO app_settings (id, full_price, prepay_percent, updated_at)
VALUES (1, 3000, 50, datetime('now'));
SQL

CANON_REAL="$(readlink -f "$CANON" 2>/dev/null || realpath "$CANON" 2>/dev/null || echo "$CANON")"

while IFS= read -r db_file; do
  [ -f "$db_file" ] || continue
  db_real="$(readlink -f "$db_file" 2>/dev/null || realpath "$db_file" 2>/dev/null || echo "$db_file")"
  count="$(sqlite3 "$db_file" "SELECT COUNT(*) FROM slots;" 2>/dev/null || echo 0)"
  avail="$(sqlite3 "$db_file" "SELECT COUNT(*) FROM slots WHERE status='available';" 2>/dev/null || echo 0)"
  size="$(wc -c < "$db_file" | tr -d ' ')"
  echo "[merge_db] found $db_file size=$size total=$count available=$avail"
  if [ "$db_real" = "$CANON_REAL" ]; then
    continue
  fi
  if [ "$count" -gt 0 ]; then
    sqlite3 "$CANON" <<SQL || echo "[merge_db] merge failed: $db_file"
ATTACH DATABASE '$db_file' AS src;
INSERT OR IGNORE INTO main.slots (slot_at, status, user_id, username, first_name, last_name, booked_at, created_at, updated_at)
SELECT slot_at, status, user_id, username, first_name, last_name, booked_at, created_at, updated_at FROM src.slots;
INSERT OR IGNORE INTO main.bookings (id, slot_id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, status, prepayment_amount, total_amount, admin_comment, created_at, updated_at)
SELECT id, slot_id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, status, prepayment_amount, total_amount, admin_comment, created_at, updated_at FROM src.bookings;
DETACH src;
SQL
  fi
done < <(find "$APP_ROOT" -name 'booking.db' 2>/dev/null | sort -u)

ls -la "${APP_ROOT}/photo-booking-bot/data/"booking.db* 2>/dev/null || true
ls -la "${APP_ROOT}/data/"booking.db* 2>/dev/null || true

FINAL="$(sqlite3 "$CANON" "SELECT COUNT(*) FROM slots;" 2>/dev/null || echo 0)"
AVAIL="$(sqlite3 "$CANON" "SELECT COUNT(*) FROM slots WHERE status='available';" 2>/dev/null || echo 0)"
echo "[merge_db] canonical total=$FINAL available=$AVAIL"
sqlite3 "$CANON" "SELECT slot_at, status FROM slots ORDER BY slot_at LIMIT 20;" 2>/dev/null || true
