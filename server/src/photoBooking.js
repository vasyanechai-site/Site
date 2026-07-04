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

function readBotEnv() {
  const envPath = path.join(REPO_ROOT, "photo-booking-bot/.env");
  const result = { fullPrice: 3000, prepayPercent: 50 };
  if (!fs.existsSync(envPath)) return result;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key === "FULL_PRICE") result.fullPrice = Number(value) || result.fullPrice;
    if (key === "PREPAY_PERCENT") result.prepayPercent = Number(value) || result.prepayPercent;
  }
  result.prepayAmount = Math.round((result.fullPrice * result.prepayPercent) / 100);
  return result;
}

function getDbPath() {
  return (
    process.env.PHOTO_BOOKING_DB_PATH ||
    path.join(REPO_ROOT, "photo-booking-bot/data/booking.db")
  );
}

function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("busy_timeout = 5000");
  ensureSchema(dbInstance);
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
  `);

  const cols = db.prepare("PRAGMA table_info(slots)").all().map((c) => c.name);
  const now = new Date().toISOString();
  if (!cols.includes("created_at")) {
    db.exec("ALTER TABLE slots ADD COLUMN created_at TEXT");
    db.prepare("UPDATE slots SET created_at = ? WHERE created_at IS NULL").run(now);
  }
  if (!cols.includes("updated_at")) {
    db.exec("ALTER TABLE slots ADD COLUMN updated_at TEXT");
    db.prepare("UPDATE slots SET updated_at = ? WHERE updated_at IS NULL").run(now);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function parseSlotDatetime(text) {
  const cleaned = String(text).trim().replace(/\s+/g, " ");
  const match = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("Формат: ДД.ММ.ГГГГ ЧЧ:ММ");
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

  app.get("/api/anna/config", annaAuthMiddleware, (_req, res) => {
    const pricing = readBotEnv();
    res.json({ pricing });
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
      const iso = dt.toISOString();
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
        const iso = dt.toISOString();
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
}
