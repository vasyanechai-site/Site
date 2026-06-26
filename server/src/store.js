import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const dataDir = path.resolve(process.cwd(), "server", "data");
const dbFile = path.join(dataDir, "db.json");
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const pgPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let pgReady = false;

const defaultDb = {
  orders: [],
  retailOrders: [],
  coffeeItems: [],
  users: [],
  promoCodes: [],
  retailProducts: [],
  categoryOrder: [],
  favoritesByUser: {},
  businessRegistrations: [],
  retailUsers: [],
  tickerSettings: {
    wholesale: { enabled: true, text: "", speed: 30 },
    retail: { enabled: true, text: "", speed: 30 },
  },
  wholesaleAccessRequests: [],
  exchangeRate: { usd_to_rub: 95, updated_at: null },
  loyaltyByUser: {},
  retailLocations: [],
  retailLocationRequests: [],
  userSettingsByUser: {},
};

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDb, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
  } catch {
    return { ...defaultDb };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

/** Стабильный ключ заказа для опта и розницы (дедуп в списках и upsert в db.json). */
function orderStableId(o) {
  if (!o || typeof o !== "object") return null;
  const id = o.orderId ?? o.order_id;
  return id != null && String(id).trim() !== "" ? String(id) : null;
}

/**
 * Один заказ на orderId: при старых дублях в db.json или повторных INSERT без PK оставляем запись с более новой date.
 */
function dedupeOrdersByStableId(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return orders;
  const map = new Map();
  const noId = [];
  for (const o of orders) {
    const id = orderStableId(o);
    if (!id) {
      noId.push(o);
      continue;
    }
    const prev = map.get(id);
    if (!prev) {
      map.set(id, o);
      continue;
    }
    const tNew = new Date(o.date || o.created_at || 0).getTime();
    const tOld = new Date(prev.date || prev.created_at || 0).getTime();
    if (tNew >= tOld) map.set(id, o);
  }
  return [...map.values(), ...noId];
}

async function pgCoreTablesExist() {
  const required = ["app_settings", "orders", "retail_orders"];
  const { rows } = await pgPool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [required],
  );
  return rows.length >= required.length;
}

async function ensurePgSchema() {
  if (!pgPool || pgReady) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS retail_orders (
        order_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (e) {
    if (e && e.code === "42501") {
      const ok = await pgCoreTablesExist();
      if (!ok) {
        throw new Error(
          "PostgreSQL: permission denied for schema public — the DB role cannot CREATE TABLE and required tables are missing. " +
            "As postgres (superuser), create tables once: psql -d YOUR_DB -f server/sql/pg-bootstrap.sql " +
            "then GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_role; " +
            "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_role; " +
            "GRANT CREATE ON SCHEMA public TO your_app_role; (see DEPLOY_REGRU.md).",
        );
      }
      console.warn(
        "[store] Skipping DDL (no CREATE on schema public); using existing orders / retail_orders / app_settings.",
      );
    } else throw e;
  }

  await pgPool.query(`
    INSERT INTO app_settings (key, payload)
    VALUES ('exchangeRate', '{"usd_to_rub":95,"updated_at":null}'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);
  pgReady = true;
}

async function getJsonSetting(key, fallback) {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM app_settings WHERE key = $1 LIMIT 1", [key]);
    return rows[0]?.payload ?? fallback;
  }
  const db = readDb();
  return db[key] ?? fallback;
}

async function setJsonSetting(key, value) {
  if (pgPool) {
    await ensurePgSchema();
    await pgPool.query(
      `INSERT INTO app_settings (key, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
    return value;
  }
  const db = readDb();
  db[key] = value;
  writeDb(db);
  return value;
}

export async function initStorage() {
  if (pgPool) await ensurePgSchema();
}

export async function getOrders() {
  let list;
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM orders ORDER BY created_at DESC");
    list = rows.map((row) => row.payload);
  } else {
    list = readDb().orders || [];
  }
  return dedupeOrdersByStableId(list);
}

export async function addOrder(order) {
  if (pgPool) {
    await ensurePgSchema();
    await pgPool.query(
      `INSERT INTO orders (order_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (order_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [order.orderId, JSON.stringify(order)],
    );
    return order;
  }
  const db = readDb();
  const list = db.orders || [];
  const id = order.orderId;
  db.orders = id ? [order, ...list.filter((o) => o.orderId !== id)] : [...list, order];
  writeDb(db);
  return order;
}

export async function getOrderById(orderId) {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM orders WHERE order_id = $1 LIMIT 1", [orderId]);
    return rows[0]?.payload || null;
  }
  return (readDb().orders || []).find((order) => order.orderId === orderId) || null;
}

export async function updateOrderById(orderId, updates) {
  const current = await getOrderById(orderId);
  if (!current) return null;
  const merged = { ...current, ...updates };
  return addOrder(merged);
}

export async function deleteOrderById(orderId) {
  if (pgPool) {
    await ensurePgSchema();
    const result = await pgPool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    return result.rowCount > 0;
  }
  const db = readDb();
  const before = (db.orders || []).length;
  db.orders = (db.orders || []).filter((order) => order.orderId !== orderId);
  writeDb(db);
  return (db.orders || []).length !== before;
}

export async function getRetailOrders() {
  let list;
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM retail_orders ORDER BY created_at DESC");
    list = rows.map((row) => row.payload);
  } else {
    list = readDb().retailOrders || [];
  }
  return dedupeOrdersByStableId(list);
}

export async function addRetailOrder(order) {
  if (pgPool) {
    await ensurePgSchema();
    await pgPool.query(
      `INSERT INTO retail_orders (order_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (order_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [order.orderId, JSON.stringify(order)],
    );
    return order;
  }
  const db = readDb();
  const list = db.retailOrders || [];
  const id = order.orderId;
  if (!id) {
    console.warn("[store] addRetailOrder: missing orderId, appending without upsert");
  }
  db.retailOrders = id ? [order, ...list.filter((o) => o.orderId !== id)] : [...list, order];
  writeDb(db);
  return order;
}

export async function getRetailOrderById(orderId) {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM retail_orders WHERE order_id = $1 LIMIT 1", [orderId]);
    return rows[0]?.payload || null;
  }
  return (readDb().retailOrders || []).find((order) => order.orderId === orderId) || null;
}

export async function deleteRetailOrderById(orderId) {
  if (pgPool) {
    await ensurePgSchema();
    const result = await pgPool.query("DELETE FROM retail_orders WHERE order_id = $1", [orderId]);
    return result.rowCount > 0;
  }
  const db = readDb();
  const before = (db.retailOrders || []).length;
  db.retailOrders = (db.retailOrders || []).filter((order) => order.orderId !== orderId);
  writeDb(db);
  return (db.retailOrders || []).length !== before;
}

export async function updateRetailOrderById(orderId, updates) {
  const current = await getRetailOrderById(orderId);
  if (!current) return null;
  const merged = { ...current, ...updates };
  return addRetailOrder(merged);
}

export async function getPendingRetailOrders() {
  const orders = await getRetailOrders();
  return orders.filter((order) => (order.paymentStatus || order.payment_status) === "pending");
}

/**
 * Счётчик номеров счетов опта.
 * Хранится в app_settings под ключом `wholesaleInvoiceCounter`:
 *   { next: number, prefix: string }
 * Дефолт: { next: 1, prefix: "1-" } → счета будут "1-1", "1-2", "1-3", ...
 */
const WHOLESALE_INVOICE_COUNTER_KEY = "wholesaleInvoiceCounter";
const DEFAULT_WHOLESALE_INVOICE_COUNTER = { next: 1, prefix: "1-" };

function normalizeCounter(raw) {
  const next = Math.max(1, Math.floor(Number(raw?.next) || 1));
  const prefix = typeof raw?.prefix === "string" ? raw.prefix : DEFAULT_WHOLESALE_INVOICE_COUNTER.prefix;
  return { next, prefix };
}

export async function getWholesaleInvoiceCounter() {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query(
      "SELECT payload FROM app_settings WHERE key = $1 LIMIT 1",
      [WHOLESALE_INVOICE_COUNTER_KEY],
    );
    return normalizeCounter(rows[0]?.payload);
  }
  const db = readDb();
  return normalizeCounter(db[WHOLESALE_INVOICE_COUNTER_KEY]);
}

/** Перезаписать счётчик целиком (для админ-настройки). */
export async function setWholesaleInvoiceCounter({ next, prefix } = {}) {
  const current = await getWholesaleInvoiceCounter();
  const payload = normalizeCounter({
    next: next != null ? next : current.next,
    prefix: prefix != null ? prefix : current.prefix,
  });
  if (pgPool) {
    await ensurePgSchema();
    await pgPool.query(
      `INSERT INTO app_settings (key, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [WHOLESALE_INVOICE_COUNTER_KEY, JSON.stringify(payload)],
    );
    return payload;
  }
  const db = readDb();
  db[WHOLESALE_INVOICE_COUNTER_KEY] = payload;
  writeDb(db);
  return payload;
}

/**
 * Атомарно резервирует следующий номер счёта: возвращает { number, prefix, next }.
 * В PostgreSQL — одной командой UPDATE ... RETURNING (без гонок при параллельных заказах).
 */
export async function reserveNextWholesaleInvoiceNumber() {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query(
      `INSERT INTO app_settings (key, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET
         payload = jsonb_set(
           app_settings.payload,
           '{next}',
           to_jsonb(COALESCE((app_settings.payload->>'next')::int, 0) + 1)
         ),
         updated_at = NOW()
       RETURNING payload`,
      [WHOLESALE_INVOICE_COUNTER_KEY, JSON.stringify({ ...DEFAULT_WHOLESALE_INVOICE_COUNTER, next: 2 })],
    );
    const after = normalizeCounter(rows[0]?.payload);
    // `next` после инкремента указывает на следующий, значит резервируем (next - 1)
    const reserved = Math.max(1, after.next - 1);
    return { number: `${after.prefix}${reserved}`, prefix: after.prefix, value: reserved };
  }
  // JSON-fallback: одна нода / один процесс — простой read-modify-write
  const current = await getWholesaleInvoiceCounter();
  const reserved = current.next;
  await setWholesaleInvoiceCounter({ next: reserved + 1, prefix: current.prefix });
  return { number: `${current.prefix}${reserved}`, prefix: current.prefix, value: reserved };
}

export async function getExchangeRate() {
  if (pgPool) {
    await ensurePgSchema();
    const { rows } = await pgPool.query("SELECT payload FROM app_settings WHERE key = 'exchangeRate' LIMIT 1");
    return rows[0]?.payload || { usd_to_rub: 95, updated_at: null };
  }
  return readDb().exchangeRate || { usd_to_rub: 95, updated_at: null };
}

export async function setExchangeRate(usd_to_rub) {
  if (pgPool) {
    await ensurePgSchema();
    const payload = { usd_to_rub, updated_at: new Date().toISOString() };
    await pgPool.query(
      `INSERT INTO app_settings (key, payload, updated_at)
       VALUES ('exchangeRate', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(payload)],
    );
    return payload;
  }
  const db = readDb();
  db.exchangeRate = { usd_to_rub, updated_at: new Date().toISOString() };
  writeDb(db);
  return db.exchangeRate;
}

export async function getRetailLoyalty(userId) {
  if (pgPool) {
    await ensurePgSchema();
    const key = `loyalty:${userId}`;
    const { rows } = await pgPool.query("SELECT payload FROM app_settings WHERE key = $1 LIMIT 1", [key]);
    return rows[0]?.payload || { userId, balance: 0, bonusClaimedAt: null };
  }
  const db = readDb();
  const value = db.loyaltyByUser?.[userId];
  return value || { userId, balance: 0, bonusClaimedAt: null };
}

export async function setRetailLoyalty(userId, updates) {
  const current = await getRetailLoyalty(userId);
  const merged = { ...current, ...updates, userId };
  if (pgPool) {
    await ensurePgSchema();
    const key = `loyalty:${userId}`;
    await pgPool.query(
      `INSERT INTO app_settings (key, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [key, JSON.stringify(merged)],
    );
    return merged;
  }
  const db = readDb();
  db.loyaltyByUser = db.loyaltyByUser || {};
  db.loyaltyByUser[userId] = merged;
  writeDb(db);
  return merged;
}

export async function getRetailLocations() {
  return getJsonSetting("retailLocations", []);
}

export async function setRetailLocations(items) {
  return setJsonSetting("retailLocations", items);
}

export async function getRetailLocationRequests() {
  return getJsonSetting("retailLocationRequests", []);
}

export async function setRetailLocationRequests(items) {
  return setJsonSetting("retailLocationRequests", items);
}

export async function getAgents() {
  return getJsonSetting("agents", []);
}

export async function setAgents(items) {
  return setJsonSetting("agents", items);
}

export async function getAgentPayouts() {
  return getJsonSetting("agentPayouts", []);
}

export async function setAgentPayouts(items) {
  return setJsonSetting("agentPayouts", items);
}

export async function getUserSettings(userId) {
  if (pgPool) {
    return getJsonSetting(`userSettings:${userId}`, {});
  }
  const db = readDb();
  return db.userSettingsByUser?.[userId] || {};
}

export async function setUserSettings(userId, settings) {
  if (pgPool) {
    return setJsonSetting(`userSettings:${userId}`, settings);
  }
  const db = readDb();
  db.userSettingsByUser = db.userSettingsByUser || {};
  db.userSettingsByUser[userId] = settings;
  writeDb(db);
  return settings;
}

export async function getCollection(key, fallback = []) {
  const value = await getJsonSetting(key, fallback);
  return Array.isArray(value) ? value : fallback;
}

export async function setCollection(key, items) {
  return setJsonSetting(key, Array.isArray(items) ? items : []);
}

export async function getMap(key, fallback = {}) {
  const value = await getJsonSetting(key, fallback);
  return value && typeof value === "object" ? value : fallback;
}

export async function setMap(key, value) {
  return setJsonSetting(key, value && typeof value === "object" ? value : {});
}

export async function getCoffeeItems() {
  return getCollection("coffeeItems", []);
}

export async function setCoffeeItems(items) {
  return setCollection("coffeeItems", items);
}

export async function getUsers() {
  return getCollection("users", []);
}

export async function setUsers(users) {
  return setCollection("users", users);
}

export async function getPromoCodes() {
  return getCollection("promoCodes", []);
}

export async function setPromoCodes(items) {
  return setCollection("promoCodes", items);
}

export async function getFavoritesByUser() {
  return getMap("favoritesByUser", {});
}

export async function setFavoritesByUser(value) {
  return setMap("favoritesByUser", value);
}

export async function getRetailProducts() {
  return getCollection("retailProducts", []);
}

export async function setRetailProducts(items) {
  return setCollection("retailProducts", items);
}

export async function getCategoryOrder() {
  return getCollection("categoryOrder", []);
}

export async function setCategoryOrder(items) {
  return setCollection("categoryOrder", items);
}

export async function getBusinessRegistrations() {
  return getCollection("businessRegistrations", []);
}

export async function setBusinessRegistrations(items) {
  return setCollection("businessRegistrations", items);
}

export async function getRetailUsers() {
  return getCollection("retailUsers", []);
}

export async function setRetailUsers(items) {
  return setCollection("retailUsers", items);
}

export async function getTickerSettings() {
  return getJsonSetting("tickerSettings", defaultDb.tickerSettings);
}

export async function setTickerSettings(value) {
  return setJsonSetting("tickerSettings", value);
}

export async function getWholesaleAccessRequests() {
  return getCollection("wholesaleAccessRequests", []);
}

export async function setWholesaleAccessRequests(items) {
  return setCollection("wholesaleAccessRequests", items);
}

/**
 * Полный снимок данных опта и розницы (как в server/data/db.json + заказы в Postgres).
 * Для восстановления из файлового режима достаточно сохранить JSON и подменить db.json (с осторожностью).
 */
export async function getFullDatabaseSnapshot() {
  const exportedAt = new Date().toISOString();
  const meta = { exportedAt, version: 2, format: "nechai-site-full" };

  if (!pgPool) {
    const db = readDb();
    const snapshot = JSON.parse(JSON.stringify(db));
    return { ...meta, ...snapshot };
  }

  await ensurePgSchema();
  const [orderRows, retailOrderRows, settingRows] = await Promise.all([
    pgPool.query("SELECT payload FROM orders ORDER BY created_at ASC"),
    pgPool.query("SELECT payload FROM retail_orders ORDER BY created_at ASC"),
    pgPool.query("SELECT key, payload FROM app_settings ORDER BY key ASC"),
  ]);

  const orders = orderRows.rows.map((r) => r.payload);
  const retailOrders = retailOrderRows.rows.map((r) => r.payload);

  const out = {
    orders,
    retailOrders,
    coffeeItems: [],
    users: [],
    promoCodes: [],
    retailProducts: [],
    categoryOrder: [],
    favoritesByUser: {},
    businessRegistrations: [],
    retailUsers: [],
    tickerSettings: { ...defaultDb.tickerSettings },
    wholesaleAccessRequests: [],
    exchangeRate: { ...defaultDb.exchangeRate },
    loyaltyByUser: {},
    retailLocations: [],
    retailLocationRequests: [],
    userSettingsByUser: {},
  };

  const arrayKeys = new Set([
    "coffeeItems",
    "users",
    "promoCodes",
    "retailProducts",
    "categoryOrder",
    "businessRegistrations",
    "retailUsers",
    "wholesaleAccessRequests",
    "retailLocations",
    "retailLocationRequests",
  ]);

  for (const row of settingRows.rows) {
    const key = row.key;
    const payload = row.payload;
    if (key.startsWith("loyalty:")) {
      out.loyaltyByUser[key.slice("loyalty:".length)] = payload;
      continue;
    }
    if (key.startsWith("userSettings:")) {
      out.userSettingsByUser[key.slice("userSettings:".length)] = payload;
      continue;
    }
    if (arrayKeys.has(key) && Array.isArray(payload)) {
      out[key] = payload;
      continue;
    }
    if (key === "favoritesByUser" && payload && typeof payload === "object") {
      out.favoritesByUser = payload;
      continue;
    }
    if (key === "tickerSettings" && payload && typeof payload === "object") {
      out.tickerSettings = payload;
      continue;
    }
    if (key === "exchangeRate" && payload && typeof payload === "object") {
      out.exchangeRate = payload;
    }
  }

  return { ...meta, ...out };
}
