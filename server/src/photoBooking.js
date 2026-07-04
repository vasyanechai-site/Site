import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { SignJWT, jwtVerify } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const SLOT_STATUSES = {
  available: "Свободен",
  reserved: "Забронирован",
  awaiting_payment: "Ожидает оплату",
  prepaid: "Предоплата внесена",
  paid_full: "Оплачено полностью",
};

const BOOKING_STATUSES = {
  reserved: "Забронирован",
  awaiting_payment: "Ожидает оплату",
  prepaid: "Предоплата внесена",
  paid_full: "Оплачено полностью",
  cancelled: "Отменено",
};

const SLOT_TO_BOOKING = {
  reserved: "reserved",
  awaiting_payment: "awaiting_payment",
  prepaid: "prepaid",
  paid_full: "paid_full",
};

let dbInstance = null;

function getDbPath() {
  return (
    process.env.PHOTO_BOOKING_DB_PATH ||
    path.join(REPO_ROOT, "photo-booking-bot/data/booking.db")
  );
}

function getDb() {
  const dbPath = getDbPath();
  if (dbInstance) {
    const currentPath = dbInstance.name;
    if (currentPath !== dbPath) {
      dbInstance.close();
      dbInstance = null;
    }
  }
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("busy_timeout = 5000");
  ensureSchema(dbInstance);
  const slotCount = dbInstance.prepare("SELECT COUNT(*) AS c FROM slots").get()?.c ?? 0;
  console.info(`[photoBooking] db=${dbPath} slots=${slotCount}`);
  return dbInstance;
}

function ensureSchema(db) {
  db.exec(`
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (slot_id) REFERENCES slots(id)
    );
    CREATE INDEX IF NOT EXISTS idx_slots_status_at ON slots(status, slot_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_price INTEGER NOT NULL DEFAULT 3000,
      prepay_percent INTEGER NOT NULL DEFAULT 50,
      updated_at TEXT
    );
  `);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO app_settings (id, full_price, prepay_percent, updated_at)
     VALUES (1, 3000, 50, ?)`
  ).run(now);

  const cols = db.prepare("PRAGMA table_info(slots)").all().map((c) => c.name);
  if (!cols.includes("created_at")) {
    db.exec("ALTER TABLE slots ADD COLUMN created_at TEXT");
    db.prepare("UPDATE slots SET created_at = ? WHERE created_at IS NULL").run(now);
  }
  if (!cols.includes("updated_at")) {
    db.exec("ALTER TABLE slots ADD COLUMN updated_at TEXT");
    db.prepare("UPDATE slots SET updated_at = ? WHERE updated_at IS NULL").run(now);
  }

  const settingsCols = db.prepare("PRAGMA table_info(app_settings)").all().map((c) => c.name);
  if (!settingsCols.includes("phone")) {
    db.exec("ALTER TABLE app_settings ADD COLUMN phone TEXT");
  }
  if (!settingsCols.includes("recipient_name")) {
    db.exec("ALTER TABLE app_settings ADD COLUMN recipient_name TEXT");
  }
  if (!settingsCols.includes("channel_monthly_price")) {
    db.exec("ALTER TABLE app_settings ADD COLUMN channel_monthly_price INTEGER DEFAULT 500");
  }
  if (!settingsCols.includes("closed_channel_telegram_id")) {
    db.exec("ALTER TABLE app_settings ADD COLUMN closed_channel_telegram_id INTEGER");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER NOT NULL,
      telegram_username TEXT,
      telegram_first_name TEXT,
      telegram_last_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      amount INTEGER NOT NULL DEFAULT 500,
      paid_at TEXT,
      starts_at TEXT,
      ends_at TEXT,
      joined_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channel_invite_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      telegram_user_id INTEGER NOT NULL,
      invite_link TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expected_user_id INTEGER NOT NULL,
      used_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      used_at TEXT,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (subscription_id) REFERENCES channel_subscriptions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_ch_sub_user ON channel_subscriptions(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_ch_sub_status ON channel_subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_ch_invite_link ON channel_invite_links(invite_link);
  `);

  normalizeUtcSlotTimestamps(db);
}

function getPricing(db) {
  const row = db.prepare(
    "SELECT full_price, prepay_percent FROM app_settings WHERE id = 1"
  ).get();
  const fullPrice = row?.full_price ?? 3000;
  const prepayPercent = row?.prepay_percent ?? 50;
  return {
    fullPrice,
    prepayPercent,
    prepayAmount: Math.round((fullPrice * prepayPercent) / 100),
  };
}

function getContactSettings(db) {
  const row = db.prepare(
    "SELECT phone, recipient_name FROM app_settings WHERE id = 1"
  ).get();
  return {
    phone: row?.phone || process.env.PHONE || "",
    recipientName: row?.recipient_name || process.env.RECIPIENT_NAME || "",
  };
}

function updateContactSettings(db, { phone, recipientName }) {
  const now = nowIso();
  if (phone !== undefined) {
    db.prepare(
      "UPDATE app_settings SET phone = ?, updated_at = ? WHERE id = 1"
    ).run(phone?.trim() || null, now);
  }
  if (recipientName !== undefined) {
    db.prepare(
      "UPDATE app_settings SET recipient_name = ?, updated_at = ? WHERE id = 1"
    ).run(recipientName?.trim() || null, now);
  }
  return getContactSettings(db);
}

function updatePricing(db, fullPrice, prepayPercent) {
  if (!Number.isInteger(fullPrice) || fullPrice <= 0) {
    throw new Error("Полная стоимость должна быть положительным числом");
  }
  if (!Number.isInteger(prepayPercent) || prepayPercent < 1 || prepayPercent > 99) {
    throw new Error("Предоплата должна быть от 1% до 99%");
  }
  db.prepare(
    `UPDATE app_settings SET full_price = ?, prepay_percent = ?, updated_at = ? WHERE id = 1`
  ).run(fullPrice, prepayPercent, nowIso());
  return getPricing(db);
}

function nowIso() {
  return new Date().toISOString();
}

/** Локальное время сервера без UTC-сдвига — как в Python-боте. */
function slotToLocalIso(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
}

function normalizeUtcSlotTimestamps(db) {
  const rows = db.prepare("SELECT id, slot_at FROM slots WHERE slot_at LIKE '%Z'").all();
  for (const row of rows) {
    const localIso = slotToLocalIso(new Date(row.slot_at));
    const duplicate = db
      .prepare("SELECT id FROM slots WHERE slot_at = ? AND id != ?")
      .get(localIso, row.id);
    if (duplicate) {
      const current = db.prepare("SELECT status FROM slots WHERE id = ?").get(row.id);
      if (current?.status === "available") {
        db.prepare("DELETE FROM slots WHERE id = ?").run(row.id);
      }
      continue;
    }
    try {
      db.prepare("UPDATE slots SET slot_at = ? WHERE id = ?").run(localIso, row.id);
    } catch (e) {
      if (!String(e.message).includes("UNIQUE")) throw e;
    }
  }
}

function parseSlotDatetime(text) {
  const cleaned = String(text).trim().replace(/\s+/g, " ");
  let match = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 12) {
      const d = digits.slice(0, 12);
      match = [
        null,
        d.slice(0, 2),
        d.slice(2, 4),
        d.slice(4, 8),
        d.slice(8, 10),
        d.slice(10, 12),
      ];
    }
  }
  if (!match) {
    throw new Error("Формат: ДД.ММ.ГГГГ ЧЧ:ММ или 12 цифр подряд");
  }
  const [, dd, mm, yyyy, hh, min] = match;
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error("Некорректная дата или время");
  return dt;
}

function parseDateOnly(text) {
  const match = String(text).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) throw new Error("Формат даты: ДД.ММ.ГГГГ");
  const [, dd, mm, yyyy] = match;
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(dt.getTime())) throw new Error("Некорректная дата");
  return dt;
}

function slotRow(row) {
  const slotAt = new Date(row.slot_at);
  return {
    id: row.id,
    slotAt: row.slot_at,
    date: slotAt.toLocaleDateString("ru-RU"),
    time: slotAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    status: row.status,
    statusLabel: SLOT_STATUSES[row.status] || row.status,
    userId: row.user_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bookingRow(row) {
  const slotAt = row.slot_at ? new Date(row.slot_at) : null;
  return {
    id: row.id,
    slotId: row.slot_id,
    slotAt: row.slot_at,
    date: slotAt ? slotAt.toLocaleDateString("ru-RU") : null,
    time: slotAt ? slotAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : null,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    telegramFirstName: row.telegram_first_name,
    telegramLastName: row.telegram_last_name,
    status: row.status,
    statusLabel: BOOKING_STATUSES[row.status] || row.status,
    prepaymentAmount: row.prepayment_amount,
    totalAmount: row.total_amount,
    adminComment: row.admin_comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getActiveBookingForSlot(db, slotId) {
  return db
    .prepare(
      `SELECT b.*, s.slot_at FROM bookings b
       JOIN slots s ON s.id = b.slot_id
       WHERE b.slot_id = ? AND b.status != 'cancelled'
       ORDER BY b.updated_at DESC LIMIT 1`
    )
    .get(slotId);
}

async function createAnnaToken() {
  const secret = new TextEncoder().encode(
    process.env.ANNA_ADMIN_TOKEN_SECRET || process.env.JWT_SECRET || "anna-photo-booking-secret"
  );
  return new SignJWT({ role: "anna-admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

async function verifyAnnaToken(token) {
  const secret = new TextEncoder().encode(
    process.env.ANNA_ADMIN_TOKEN_SECRET || process.env.JWT_SECRET || "anna-photo-booking-secret"
  );
  const { payload } = await jwtVerify(token, secret);
  return payload.role === "anna-admin";
}

function annaAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  verifyAnnaToken(token)
    .then((ok) => {
      if (!ok) return res.status(401).json({ error: "Unauthorized" });
      return next();
    })
    .catch(() => res.status(401).json({ error: "Unauthorized" }));
}

export function registerPhotoBookingRoutes(app) {
  app.post("/api/anna/auth", async (req, res) => {
    const password = String(req.body?.password || "");
    const expected = process.env.ANNA_ADMIN_PASSWORD || "4321";
    if (password !== expected) {
      return res.status(401).json({ error: "Неверный пароль" });
    }
    const token = await createAnnaToken();
    return res.json({ token });
  });

  app.get("/api/anna/settings", annaAuthMiddleware, (_req, res) => {
    const db = getDb();
    res.json({ pricing: getPricing(db), contact: getContactSettings(db) });
  });

  app.patch("/api/anna/settings", annaAuthMiddleware, (req, res) => {
    try {
      const db = getDb();
      const current = getPricing(db);
      const fullPrice =
        req.body?.fullPrice !== undefined ? Number(req.body.fullPrice) : current.fullPrice;
      const prepayPercent =
        req.body?.prepayPercent !== undefined
          ? Number(req.body.prepayPercent)
          : current.prepayPercent;
      const pricing = updatePricing(db, fullPrice, prepayPercent);
      let contact;
      if (req.body?.phone !== undefined || req.body?.recipientName !== undefined) {
        contact = updateContactSettings(db, {
          phone: req.body?.phone,
          recipientName: req.body?.recipientName,
        });
      } else {
        contact = getContactSettings(db);
      }
      res.json({ pricing, contact });
    } catch (e) {
      res.status(400).json({ error: e.message || "Invalid settings" });
    }
  });

  /** @deprecated use /api/anna/settings */
  app.get("/api/anna/config", annaAuthMiddleware, (_req, res) => {
    const db = getDb();
    res.json({ pricing: getPricing(db) });
  });

  app.get("/api/anna/sync-status", annaAuthMiddleware, (_req, res) => {
    const dbPath = getDbPath();
    let dbExists = false;
    let dbSize = 0;
    try {
      const st = fs.statSync(dbPath);
      dbExists = st.isFile();
      dbSize = st.size;
    } catch {
      /* missing */
    }
    const db = getDb();
    const now = nowIso();
    const total = db.prepare("SELECT COUNT(*) AS c FROM slots").get()?.c ?? 0;
    const available = db
      .prepare("SELECT COUNT(*) AS c FROM slots WHERE status = 'available' AND slot_at >= ?")
      .get(now)?.c ?? 0;
    const futureDates = db
      .prepare(
        `SELECT COUNT(DISTINCT date(slot_at)) AS c FROM slots
         WHERE status = 'available' AND slot_at >= ?`
      )
      .get(now)?.c ?? 0;
    const relayUrl =
      process.env.TELEGRAM_RELAY_URL ||
      process.env.TELEGRAM_BOT_PROXY_URL ||
      "https://telegram-relay.coffeenechai.workers.dev";
    const relayOk = !relayUrl.includes("telegram-bot-proxy");
    res.json({
      dbPath,
      dbExists,
      dbSize,
      slots: { total, available, futureDates },
      relay: { url: relayUrl, configured: relayOk },
      hint: relayOk
        ? available > 0
          ? "Админка видит слоты. Если бот пишет «нет слотов» — проверьте /dbcheck в Telegram."
          : "В БД нет свободных слотов — добавьте через «Добавить слот»."
        : "Неверный TELEGRAM relay URL (старый telegram-bot-proxy). Нужен telegram-relay.coffeenechai.workers.dev",
    });
  });

  app.get("/api/anna/stats", annaAuthMiddleware, (_req, res) => {
    const db = getDb();
    const now = nowIso();
    const future = db.prepare("SELECT * FROM slots WHERE slot_at >= ?").all(now);
    const cancelled = db
      .prepare("SELECT COUNT(*) AS c FROM bookings WHERE status = 'cancelled'")
      .get().c;

    const counts = {
      totalFuture: future.length,
      available: 0,
      reserved: 0,
      awaiting_payment: 0,
      prepaid: 0,
      paid_full: 0,
      cancelled,
    };
    for (const row of future) {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    }

    const nearest = db
      .prepare(
        `SELECT slot_at FROM slots
         WHERE slot_at >= ? AND status != 'available'
         ORDER BY slot_at ASC LIMIT 1`
      )
      .get(now);

    res.json({
      counts,
      nearestSession: nearest?.slot_at || null,
    });
  });

  app.get("/api/anna/calendar", annaAuthMiddleware, (req, res) => {
    const month = String(req.query.month || "");
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match) return res.status(400).json({ error: "month=YYYY-MM required" });

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT date(slot_at) AS day, status, COUNT(*) AS cnt
         FROM slots
         WHERE strftime('%Y-%m', slot_at) = ?
         GROUP BY day, status`
      )
      .all(month);

    const days = {};
    for (const row of rows) {
      if (!days[row.day]) {
        days[row.day] = { total: 0, available: 0, occupied: 0, byStatus: {} };
      }
      days[row.day].total += row.cnt;
      days[row.day].byStatus[row.status] = row.cnt;
      if (row.status === "available") days[row.day].available += row.cnt;
      else days[row.day].occupied += row.cnt;
    }
    res.json({ month, days });
  });

  app.get("/api/anna/slots", annaAuthMiddleware, (req, res) => {
    const date = String(req.query.date || "");
    const db = getDb();
    let rows;
    if (date) {
      rows = db
        .prepare(
          `SELECT * FROM slots WHERE date(slot_at) = date(?) ORDER BY slot_at`
        )
        .all(`${date}T00:00:00`);
    } else {
      rows = db.prepare("SELECT * FROM slots ORDER BY slot_at DESC LIMIT 500").all();
    }

    const result = rows.map((row) => {
      const slot = slotRow(row);
      const booking = getActiveBookingForSlot(db, row.id);
      return {
        ...slot,
        booking: booking ? bookingRow(booking) : null,
      };
    });
    res.json(result);
  });

  app.post("/api/anna/slots", annaAuthMiddleware, (req, res) => {
    try {
      const dateStr = String(req.body?.date || "").trim();
      const timeStr = String(req.body?.time || "").trim();
      const dt = parseSlotDatetime(`${dateStr} ${timeStr}`);
      if (dt <= new Date()) throw new Error("Слот должен быть в будущем");

      const db = getDb();
      const iso = slotToLocalIso(dt);
      const now = nowIso();
      try {
        db.prepare(
          `INSERT INTO slots (slot_at, status, created_at, updated_at) VALUES (?, 'available', ?, ?)`
        ).run(iso, now, now);
      } catch (e) {
        if (String(e.message).includes("UNIQUE")) {
          throw new Error("Слот уже существует");
        }
        throw e;
      }
      const row = db.prepare("SELECT * FROM slots WHERE slot_at = ?").get(iso);
      res.json({ slot: slotRow(row) });
    } catch (e) {
      res.status(400).json({ error: e.message || "Invalid slot" });
    }
  });

  app.post("/api/anna/slots/bulk", annaAuthMiddleware, (req, res) => {
    const text = String(req.body?.text || "");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const db = getDb();
    const added = [];
    const errors = [];
    const insert = db.prepare(
      `INSERT INTO slots (slot_at, status, created_at, updated_at) VALUES (?, 'available', ?, ?)`
    );

    for (const line of lines) {
      try {
        const dt = parseSlotDatetime(line);
        if (dt <= new Date()) throw new Error("Слот должен быть в будущем");
        const iso = slotToLocalIso(dt);
        const now = nowIso();
        insert.run(iso, now, now);
        added.push(iso);
      } catch (e) {
        errors.push({ line, error: e.message || String(e) });
      }
    }
    res.json({ added: added.length, errors });
  });

  app.delete("/api/anna/slots/:id", annaAuthMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const row = db.prepare("SELECT * FROM slots WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Слот не найден" });
    if (row.status !== "available") {
      return res.status(400).json({ error: "Нельзя удалить занятый слот" });
    }
    db.prepare("DELETE FROM slots WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  app.get("/api/anna/bookings", annaAuthMiddleware, (req, res) => {
    const db = getDb();
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();
    const future = req.query.future === "true";
    const past = req.query.past === "true";

    let sql = `
      SELECT b.*, s.slot_at FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += " AND b.status = ?";
      params.push(status);
    }
    if (future) {
      sql += " AND s.slot_at >= ?";
      params.push(nowIso());
    }
    if (past) {
      sql += " AND s.slot_at < ?";
      params.push(nowIso());
    }
    sql += " ORDER BY s.slot_at DESC, b.updated_at DESC LIMIT 500";

    let rows = db.prepare(sql).all(...params);
    if (search) {
      rows = rows.filter((row) => {
        const hay = [
          row.telegram_username,
          row.telegram_first_name,
          row.telegram_last_name,
          String(row.telegram_user_id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      });
    }
    res.json(rows.map(bookingRow));
  });

  app.patch("/api/anna/bookings/:id", annaAuthMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
    if (!booking) return res.status(404).json({ error: "Запись не найдена" });

    const nextStatus = req.body?.status ? String(req.body.status) : null;
    const adminComment =
      req.body?.adminComment !== undefined ? String(req.body.adminComment) : undefined;
    const now = nowIso();

    if (nextStatus && !BOOKING_STATUSES[nextStatus]) {
      return res.status(400).json({ error: "Неизвестный статус" });
    }

    if (adminComment !== undefined) {
      db.prepare("UPDATE bookings SET admin_comment = ?, updated_at = ? WHERE id = ?").run(
        adminComment,
        now,
        id
      );
    }

    if (nextStatus) {
      db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?").run(
        nextStatus,
        now,
        id
      );

      if (nextStatus === "cancelled") {
        db.prepare(
          `UPDATE slots SET status = 'available', user_id = NULL, username = NULL,
           first_name = NULL, last_name = NULL, booked_at = NULL, updated_at = ?
           WHERE id = ?`
        ).run(now, booking.slot_id);
      } else if (["reserved", "awaiting_payment", "prepaid", "paid_full"].includes(nextStatus)) {
        db.prepare("UPDATE slots SET status = ?, updated_at = ? WHERE id = ?").run(
          nextStatus,
          now,
          booking.slot_id
        );
      }
    }

    const updated = db
      .prepare(
        `SELECT b.*, s.slot_at FROM bookings b
         JOIN slots s ON s.id = b.slot_id WHERE b.id = ?`
      )
      .get(id);
    res.json(bookingRow(updated));
  });

  const CHANNEL_STATUS_LABELS = {
    pending_payment: "Ожидает оплату",
    active: "Активна",
    expired: "Истекла",
    cancelled: "Отменена",
  };
  const INVITE_STATUS_LABELS = {
    pending: "Ожидает",
    used_ok: "Использована",
    used_wrong_user: "Чужой пользователь",
    expired: "Истекла",
    revoked: "Отозвана",
  };

  function channelSubRow(row, invite) {
    return {
      id: row.id,
      telegramUserId: row.telegram_user_id,
      telegramUsername: row.telegram_username,
      telegramFirstName: row.telegram_first_name,
      telegramLastName: row.telegram_last_name,
      status: row.status,
      statusLabel: CHANNEL_STATUS_LABELS[row.status] || row.status,
      amount: row.amount,
      paidAt: row.paid_at,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      inviteStatus: invite?.status ?? null,
      inviteStatusLabel: invite ? INVITE_STATUS_LABELS[invite.status] || invite.status : null,
      inviteLink: invite?.invite_link ?? null,
    };
  }

  function expireChannelSubs(db) {
    const now = nowIso();
    db.prepare(
      `UPDATE channel_subscriptions SET status = 'expired', updated_at = ?
       WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at < ?`
    ).run(now, now);
  }

  function getChannelStats(db) {
    expireChannelSubs(db);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getTime() - 30 * 86400000).toISOString();
    return {
      totalPaid: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE paid_at IS NOT NULL").get().c,
      active: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE status = 'active'").get().c,
      joined: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE joined_at IS NOT NULL").get().c,
      paidNotJoined: db.prepare(
        "SELECT COUNT(*) AS c FROM channel_subscriptions WHERE status = 'active' AND paid_at IS NOT NULL AND joined_at IS NULL"
      ).get().c,
      expired: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE status = 'expired'").get().c,
      cancelled: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE status = 'cancelled'").get().c,
      newToday: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE paid_at >= ?").get(todayStart).c,
      newWeek: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE paid_at >= ?").get(weekStart).c,
      newMonth: db.prepare("SELECT COUNT(*) AS c FROM channel_subscriptions WHERE paid_at >= ?").get(monthStart).c,
      revenueToday: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM channel_subscriptions WHERE paid_at >= ?").get(todayStart).s,
      revenueWeek: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM channel_subscriptions WHERE paid_at >= ?").get(weekStart).s,
      revenueMonth: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM channel_subscriptions WHERE paid_at >= ?").get(monthStart).s,
      revenueTotal: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM channel_subscriptions WHERE paid_at IS NOT NULL").get().s,
      lastPaymentAt: db.prepare("SELECT paid_at FROM channel_subscriptions WHERE paid_at IS NOT NULL ORDER BY paid_at DESC LIMIT 1").get()?.paid_at ?? null,
      lastJoinAt: db.prepare("SELECT joined_at FROM channel_subscriptions WHERE joined_at IS NOT NULL ORDER BY joined_at DESC LIMIT 1").get()?.joined_at ?? null,
      monthlyPrice: db.prepare("SELECT channel_monthly_price FROM app_settings WHERE id = 1").get()?.channel_monthly_price ?? 500,
      channelTelegramId: db.prepare("SELECT closed_channel_telegram_id FROM app_settings WHERE id = 1").get()?.closed_channel_telegram_id ?? null,
    };
  }

  app.get("/api/anna/channel/stats", annaAuthMiddleware, (_req, res) => {
    const db = getDb();
    res.json(getChannelStats(db));
  });

  app.get("/api/anna/channel/subscribers", annaAuthMiddleware, (req, res) => {
    const db = getDb();
    expireChannelSubs(db);
    const status = req.query.status ? String(req.query.status) : "";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const clauses = [];
    const params = [];
    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }
    if (search) {
      clauses.push("(LOWER(COALESCE(telegram_username,'')) LIKE ? OR LOWER(COALESCE(telegram_first_name,'')) LIKE ? OR CAST(telegram_user_id AS TEXT) LIKE ?)");
      const q = `%${search.toLowerCase()}%`;
      params.push(q, q, q);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(`SELECT * FROM channel_subscriptions ${where} ORDER BY id DESC LIMIT 500`).all(...params);
    const result = rows.map((row) => {
      const invite = db.prepare(
        "SELECT * FROM channel_invite_links WHERE subscription_id = ? ORDER BY id DESC LIMIT 1"
      ).get(row.id);
      return channelSubRow(row, invite);
    });
    res.json(result);
  });

  app.post("/api/anna/channel/subscribers/:id/:action", annaAuthMiddleware, (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const action = String(req.params.action);
    const sub = db.prepare("SELECT * FROM channel_subscriptions WHERE id = ?").get(id);
    if (!sub) return res.status(404).json({ error: "Подписчик не найден" });
    const now = nowIso();
    if (action === "cancel") {
      db.prepare("UPDATE channel_subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, id);
    } else if (action === "activate" || action === "extend") {
      const starts = action === "extend" && sub.ends_at && sub.ends_at > now ? sub.starts_at : now;
      const base = action === "extend" && sub.ends_at && sub.ends_at > now ? new Date(sub.ends_at) : new Date();
      const ends = new Date(base.getTime() + 30 * 86400000).toISOString();
      db.prepare(
        "UPDATE channel_subscriptions SET status = 'active', paid_at = COALESCE(paid_at, ?), starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?"
      ).run(now, starts || now, ends, now, id);
    } else {
      return res.status(400).json({ error: "Unknown action" });
    }
    const updated = db.prepare("SELECT * FROM channel_subscriptions WHERE id = ?").get(id);
    const invite = db.prepare(
      "SELECT * FROM channel_invite_links WHERE subscription_id = ? ORDER BY id DESC LIMIT 1"
    ).get(id);
    res.json(channelSubRow(updated, invite));
  });

  app.patch("/api/anna/channel/settings", annaAuthMiddleware, (req, res) => {
    const db = getDb();
    const now = nowIso();
    if (req.body?.monthlyPrice != null) {
      const price = Number(req.body.monthlyPrice);
      if (!Number.isInteger(price) || price <= 0) {
        return res.status(400).json({ error: "Некорректная стоимость" });
      }
      db.prepare("UPDATE app_settings SET channel_monthly_price = ?, updated_at = ? WHERE id = 1").run(
        price,
        now
      );
    }
    if (req.body?.channelTelegramId != null && req.body.channelTelegramId !== "") {
      const raw = String(req.body.channelTelegramId).trim();
      let channelId = null;
      const m = raw.match(/t\.me\/c\/(\d+)/i);
      if (m) {
        channelId = Number(`-100${m[1]}`);
      } else if (/^-100\d+$/.test(raw)) {
        channelId = Number(raw);
      } else if (/^\d{9,}$/.test(raw)) {
        channelId = Number(`-100${raw}`);
      }
      if (!channelId) {
        return res.status(400).json({ error: "Некорректный ID или ссылка канала" });
      }
      db.prepare("UPDATE app_settings SET closed_channel_telegram_id = ?, updated_at = ? WHERE id = 1").run(
        channelId,
        now
      );
    }
    const row = db.prepare(
      "SELECT channel_monthly_price, closed_channel_telegram_id FROM app_settings WHERE id = 1"
    ).get();
    res.json({
      monthlyPrice: row?.channel_monthly_price ?? 500,
      channelTelegramId: row?.closed_channel_telegram_id ?? null,
    });
  });
}
