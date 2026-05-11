import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { calculateDelivery, getPickupPoints, searchCities } from "./cdek.js";
import { createRetailOrderFromCheckout } from "./retailOrderCreate.js";
import { signRetailToken, verifyRetailToken } from "./retailAuthToken.js";
import { createWholesaleTochkaBill } from "./tochkaWholesaleInvoice.js";
import {
  buildPaymentsWithReceiptData,
  fetchPaymentsWithReceipt,
  extractPaymentLink,
  extractOperationId,
  tochkaClientPhone,
} from "./tochkaAcquiringReceipt.js";
import {
  addOrder,
  addRetailOrder,
  deleteOrderById,
  deleteRetailOrderById,
  getExchangeRate,
  initStorage,
  getOrderById,
  getOrders,
  getRetailOrderById,
  getRetailOrders,
  getPendingRetailOrders,
  getRetailLoyalty,
  getRetailLocationRequests,
  getRetailLocations,
  setExchangeRate,
  setRetailLocationRequests,
  setRetailLocations,
  setRetailLoyalty,
  setUserSettings,
  updateOrderById,
  updateRetailOrderById,
  getUserSettings,
  getCoffeeItems,
  setCoffeeItems,
  getUsers,
  setUsers,
  getPromoCodes,
  setPromoCodes,
  getFavoritesByUser,
  setFavoritesByUser,
  getRetailProducts,
  setRetailProducts,
  getCategoryOrder,
  setCategoryOrder,
  getBusinessRegistrations,
  setBusinessRegistrations,
  getRetailUsers,
  setRetailUsers,
  getTickerSettings,
  setTickerSettings,
  getWholesaleAccessRequests,
  setWholesaleAccessRequests,
  getFullDatabaseSnapshot,
} from "./store.js";
import {
  telegramNotify,
  formatWholesaleOrderMessage,
  formatRetailOrderMessage,
  formatWholesaleAccessRequest,
  formatBusinessRegistration,
  formatLocationRequest,
  formatPaymentReceived,
  formatNewRetailUserCreated,
  formatNewWholesaleUserCreated,
} from "./telegram.js";
import { registerDebugRoutes } from "./debugRoutes.js";
import { registerAgentRoutes } from "./agentsRoutes.js";
import { transliterateProductName } from "./retailSlug.js";
import { verifyTochkaWebhookJwt } from "./tochkaWebhookVerify.js";

const __apiDir = path.dirname(fileURLToPath(import.meta.url));
const __repoRoot = path.resolve(__apiDir, "../..");
dotenv.config({ path: path.resolve(__apiDir, "../../.env") });
dotenv.config();

/** Полный бэкап + письмо: тот же сценарий, что `node server/scripts/weekly-email-backup.mjs` (SMTP в .env). */
function runWeeklyEmailBackupScript() {
  const scriptPath = path.join(__repoRoot, "server/scripts/weekly-email-backup.mjs");
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [scriptPath], {
      cwd: __repoRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (c) => {
      stdout += c;
    });
    proc.stderr?.on("data", (c) => {
      stderr += c;
    });
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Таймаут отправки бэкапа (120 с)"));
    }, 120_000);
    proc.on("error", reject);
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(stderr.trim() || stdout.trim() || `Скрипт завершился с кодом ${code}`));
    });
  });
}

// Исходящие запросы (Telegram и др.): на части VPS IPv6 «чёрная дыра» → fetch failed без деталей.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 8787);
const allowedOriginsRaw =
  process.env.ALLOWED_ORIGINS ||
  process.env.ALLOWED_ORIGIN ||
  "*";
const allowedOrigins = String(allowedOriginsRaw)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** В development не привязываемся к одному порту Vite (5173 может быть занят → 5174). */
const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
const corsOriginOption =
  nodeEnv === "development"
    ? true
    : allowedOrigins.length === 1 && allowedOrigins[0] === "*"
      ? true
      : (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          return cb(null, false);
        };
const uploadDir = path.resolve(process.cwd(), "server", "data", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

app.use(cors({ origin: corsOriginOption }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/uploads", express.static(uploadDir));
registerAgentRoutes(app);

/** Публичный origin API для ссылок на `/api/uploads/…` (тот же хост, что у запроса за nginx; не сайт из FRONTEND_BASE_URL). */
function publicApiOrigin(req) {
  const fromEnv = String(process.env.PUBLIC_API_BASE_URL || process.env.API_UPLOAD_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const xfHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = xfHost || String(req.headers.host || "").trim();
  if (!host) return "";
  const xfProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto = xfProto || (req.secure ? "https" : "http");
  return `${proto}://${host}`;
}

const DEFAULT_CATEGORY_ORDER = ["Фильтр", "Эспрессо", "Дрип", "Оборудование", "Аксессуары"];

function byDateDesc(a, b) {
  return new Date(b?.date || 0) - new Date(a?.date || 0);
}

function sanitizeUser(user) {
  if (!user || typeof user !== "object") return user;
  const { password, ...safeUser } = user;
  return safeUser;
}

function sanitizeUsers(users) {
  return Array.isArray(users) ? users.map(sanitizeUser) : [];
}

async function seedDefaultAdmin() {
  const adminPhone = "79819747388";
  const adminPassword = "NechaiPass2026";

  const users = await getUsers();
  const existing = users.find((u) => u.phone === adminPhone);

  if (!existing) {
    const admin = {
      id: `admin-${Date.now()}`,
      name: "Nechai Admin",
      phone: adminPhone,
      password: adminPassword,
      role: "admin",
      created_at: new Date().toISOString(),
      loyaltyLevel: 0,
      discount: 0,
      totalKg: 0,
    };
    await setUsers([admin, ...users]);
    return;
  }

  if (existing.role !== "admin" || existing.password !== adminPassword) {
    const updated = { ...existing, role: "admin", password: adminPassword };
    await setUsers(users.map((u) => (u.id === existing.id ? updated : u)));
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "site-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
  });
});

app.get("/api/keep-alive", (_req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: "Server is alive",
  });
});

/** Для опта/каталога: только опубликованные (`published === false` — скрыто). */
function filterPublishedCoffeeItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && item.published !== false);
}

app.get("/api/coffee-items", async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  const items = await getCoffeeItems();
  res.json(filterPublishedCoffeeItems(items));
});

app.get("/api/coffee-items-admin", async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.json(await getCoffeeItems());
});

app.post("/api/coffee-items", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const items = await getCoffeeItems();
  const id = body.id || `coffee-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const item = {
    ...body,
    id,
    published: body.published !== undefined ? Boolean(body.published) : true,
    no_discount: body.no_discount !== undefined ? Boolean(body.no_discount) : false,
  };
  await setCoffeeItems([...items.filter((x) => x.id !== item.id), item]);
  res.status(201).json(item);
});

app.put("/api/coffee-items/:id", async (req, res) => {
  const { id } = req.params;
  const items = await getCoffeeItems();
  const current = items.find((x) => x.id === id);
  if (!current) return res.status(404).json({ error: "Coffee item not found" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const updated = { ...current, ...body, id };
  // Явно сохраняем boolean, чтобы false не «терялся» при частичных обновлениях
  if (Object.prototype.hasOwnProperty.call(body, "published")) {
    updated.published = Boolean(body.published);
  }
  if (Object.prototype.hasOwnProperty.call(body, "no_discount")) {
    updated.no_discount = Boolean(body.no_discount);
  }
  await setCoffeeItems(items.map((x) => (x.id === id ? updated : x)));
  res.json(updated);
});

app.put("/api/coffee-items-reorder", async (req, res) => {
  const next = Array.isArray(req.body?.items) ? req.body.items : [];
  const current = await getCoffeeItems();
  const force =
    String(req.query.force || "") === "1" ||
    String(req.query.force || "").toLowerCase() === "true";
  const shrinkBlocked =
    !force &&
    next.length > 0 &&
    current.length > next.length &&
    ((current.length >= 10 &&
      next.length < Math.floor(current.length * 0.25)) ||
      (current.length >= 6 && next.length < current.length - 2));
  if (shrinkBlocked) {
    return res.status(400).json({
      error:
        "Сохранение порядка отклонено: список позиций сократился слишком сильно (часто из‑за сбоя UI после перетаскивания). Обновите страницу админки и повторите; при осознанной массовой правке можно вызвать API с query force=1.",
    });
  }
  await setCoffeeItems(next);
  res.json({ success: true });
});

app.delete("/api/coffee-items/:id", async (req, res) => {
  const items = await getCoffeeItems();
  await setCoffeeItems(items.filter((x) => x.id !== req.params.id));
  res.json({ success: true });
});

app.get("/api/users", async (_req, res) => {
  res.json(sanitizeUsers(await getUsers()));
});

app.post("/api/users", async (req, res) => {
  const body = req.body || {};
  const users = await getUsers();
  if (body.phone && users.some((x) => x.phone === body.phone)) {
    return res.status(409).json({ error: "User with this phone already exists" });
  }
  const user = {
    id: body.id || `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: body.created_at || new Date().toISOString(),
    loyaltyLevel: 0,
    discount: 0,
    totalKg: 0,
    ...body,
  };
  await setUsers([user, ...users]);
  void telegramNotify("wholesale_user_created", formatNewWholesaleUserCreated(user)).catch((e) =>
    console.error("[users POST] telegram", e),
  );
  res.status(201).json(sanitizeUser(user));
});

app.post("/api/retail-signup", async (req, res) => {
  const body = req.body || {};
  const users = await getRetailUsers();
  if (body.email && users.some((x) => String(x.email || "").toLowerCase() === String(body.email).toLowerCase())) {
    return res.status(409).json({ error: "Пользователь с таким email уже существует" });
  }
  const user = {
    id: body.id || `retail-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    role: body.role || "user",
    createdAt: body.createdAt || new Date().toISOString(),
    bonusPoints: Number(body.bonusPoints || 0),
    ...body,
  };
  await setRetailUsers([user, ...users]);
  const loyalty = await getRetailLoyalty(user.id);
  void telegramNotify("retail_signup", formatNewRetailUserCreated(user, loyalty)).catch((e) =>
    console.error("[retail-signup] telegram", e),
  );
  res.status(201).json({ success: true, user: sanitizeUser(user) });
});

app.post("/api/auth/retail/login", async (req, res) => {
  const { email, password } = req.body || {};
  const em = String(email || "").trim().toLowerCase();
  if (!em || !password) {
    return res.status(400).json({ error: "Укажите email и пароль" });
  }
  const users = await getRetailUsers();
  const user = users.find(
    (x) => String(x.email || "").toLowerCase() === em && String(x.password || "") === String(password),
  );
  if (!user) {
    return res.status(401).json({ error: "Неверный email или пароль" });
  }
  const access_token = signRetailToken({
    sub: user.id,
    email: user.email,
    role: user.role || "user",
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ access_token, user: sanitizeUser(user) });
});

app.get("/api/auth/retail/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const v = verifyRetailToken(token);
  if (!v?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = await getRetailUsers();
  const user = users.find((x) => x.id === v.sub);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({ user: sanitizeUser(user) });
});

app.post("/api/users/login", async (req, res) => {
  const { phone, password } = req.body || {};
  const users = await getUsers();
  const user = users.find((x) => x.phone === phone && x.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json(sanitizeUser(user));
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const users = await getUsers();
  const current = users.find((x) => x.id === id);
  if (!current) return res.status(404).json({ error: "User not found" });
  const updated = { ...current, ...(req.body || {}), id };
  await setUsers(users.map((x) => (x.id === id ? updated : x)));
  res.json(sanitizeUser(updated));
});

app.delete("/api/users/:id", async (req, res) => {
  const users = await getUsers();
  await setUsers(users.filter((x) => x.id !== req.params.id));
  res.json({ success: true });
});

app.get("/api/users/:id/orders", async (req, res) => {
  const { id } = req.params;
  const wholesale = (await getOrders()).filter((o) => o.userId === id || o.user_id === id);
  const retail = (await getRetailOrders()).filter((o) => o.userId === id || o.user_id === id);
  res.json([...wholesale, ...retail].sort(byDateDesc));
});

app.get("/api/users/:id/loyalty", async (req, res) => {
  const { id } = req.params;
  const users = await getUsers();
  const user = users.find((x) => x.id === id);
  const totalKg = Number(user?.totalKg || 0);
  const loyaltyLevel = Number(user?.loyaltyLevel || 0);
  const discount = Number(user?.discount || 0);
  res.json({
    loyaltyLevel,
    discount,
    loyaltyLevelSetDate: user?.loyaltyLevelSetDate || new Date().toISOString(),
    totalKg,
    ordersIn3Mo: 0,
    ordersIn6Mo: 0,
    ordersIn12Mo: 0,
    autoLevel: loyaltyLevel,
    autoDiscount: discount,
    isManualOverride: false,
    nextLevel: null,
  });
});

app.post("/api/wholesale/request-access", async (req, res) => {
  const requests = await getWholesaleAccessRequests();
  const item = {
    id: `wholesale-access-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...(req.body || {}),
  };
  await setWholesaleAccessRequests([item, ...requests]);
  await telegramNotify("wholesale_access", formatWholesaleAccessRequest(item));
  res.status(201).json({ success: true, request: item });
});

app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};
    const order = {
      orderId: body.orderId || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: body.date || new Date().toISOString(),
      orderType: "wholesale",
      ...body,
    };
    let saved = await addOrder(order);
    const bill = await createWholesaleTochkaBill(saved);
    if (bill) {
      saved =
        (await updateOrderById(saved.orderId, {
          invoiceId: bill.invoiceId,
          invoiceCreatedAt: new Date().toISOString(),
          invoiceUrl: bill.invoiceUrl,
        })) || saved;
    }
    await telegramNotify("wholesale_order", formatWholesaleOrderMessage(saved));
    res.json(saved);
  } catch (e) {
    console.error("[orders] POST /api/orders", e?.message || e);
    res.status(500).json({ error: e?.message || "Failed to create order" });
  }
});

app.get("/api/orders", async (_req, res) => {
  const data = (await getOrders()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  res.json(data);
});

app.get("/api/orders/:orderId", async (req, res) => {
  const order = await getOrderById(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

app.delete("/api/orders/:orderId", async (req, res) => {
  const removed = await deleteOrderById(req.params.orderId);
  if (!removed) return res.status(404).json({ error: "Order not found" });
  res.json({ success: true });
});

app.get("/api/exchange-rate", async (_req, res) => {
  res.json(await getExchangeRate());
});

app.put("/api/exchange-rate", async (req, res) => {
  const rate = Number(req.body?.usd_to_rub);
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: "usd_to_rub must be a positive number" });
  }
  res.json(await setExchangeRate(rate));
});

app.post("/api/retail/orders", async (req, res) => {
  try {
    const body = req.body || {};
    /** Оформление с сайта: items[].product + customerName */
    const isCheckoutPayload =
      Boolean(body.customerName) &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      body.items[0]?.product;

    let saved;
    if (isCheckoutPayload) {
      saved = await createRetailOrderFromCheckout(body);
    } else {
      const order = {
        orderId: body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: body.date || new Date().toISOString(),
        orderType: "retail",
        paymentStatus: body.paymentStatus || "pending",
        ...body,
      };
      saved = await addRetailOrder(order);
    }
    await telegramNotify("retail_order", formatRetailOrderMessage(saved));
    res.json(saved);
  } catch (e) {
    const code = e?.statusCode === 400 ? 400 : 500;
    console.error("[retail/orders POST]", e?.message || e);
    res.status(code).json({ error: e?.message || "Failed to create retail order" });
  }
});

app.get("/api/retail/loyalty/:userId", async (req, res) => {
  const loyalty = await getRetailLoyalty(req.params.userId);
  res.json(loyalty);
});

app.post("/api/retail/loyalty/claim-bonus", async (req, res) => {
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const current = await getRetailLoyalty(userId);
  if (current.bonusClaimedAt) {
    return res.status(400).json({ error: "Bonus already claimed", balance: current.balance });
  }
  const updated = await setRetailLoyalty(userId, {
    balance: Number(current.balance || 0) + 2000,
    bonusClaimedAt: new Date().toISOString(),
  });
  res.json(updated);
});

app.get("/api/retail-locations", async (_req, res) => {
  res.json(await getRetailLocations());
});

app.post("/api/retail-locations", async (req, res) => {
  const body = req.body || {};
  const locations = await getRetailLocations();
  const id = body.id || `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const location = { ...body, id };
  await setRetailLocations([...locations.filter((x) => x.id !== id), location]);
  res.json(location);
});

app.put("/api/retail-locations/:id", async (req, res) => {
  const id = req.params.id;
  const locations = await getRetailLocations();
  const current = locations.find((x) => x.id === id);
  if (!current) return res.status(404).json({ error: "Location not found" });
  const updated = { ...current, ...(req.body || {}), id };
  await setRetailLocations(locations.map((x) => (x.id === id ? updated : x)));
  res.json(updated);
});

app.delete("/api/retail-locations/:id", async (req, res) => {
  const id = req.params.id;
  const locations = await getRetailLocations();
  const next = locations.filter((x) => x.id !== id);
  await setRetailLocations(next);
  res.json({ success: true });
});

app.delete("/api/retail-locations", async (_req, res) => {
  await setRetailLocations([]);
  res.json({ success: true });
});

app.post("/api/retail-locations/init", async (_req, res) => {
  const current = await getRetailLocations();
  if (current.length > 0) return res.json({ success: true, count: current.length });
  const seed = [
    {
      id: "loc-spb-1",
      city: "Санкт-Петербург",
      name: "Nechai Coffee",
      address: "Санкт-Петербург",
      status: "approved",
    },
  ];
  await setRetailLocations(seed);
  res.json({ success: true, count: seed.length });
});

app.post("/api/retail-locations/submit-request", async (req, res) => {
  const body = req.body || {};
  const requests = await getRetailLocationRequests();
  const item = {
    id: `locreq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...body,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };
  await setRetailLocationRequests([item, ...requests]);
  await telegramNotify("location_request", formatLocationRequest(item));
  res.json(item);
});

app.get("/api/retail-locations/requests", async (_req, res) => {
  res.json(await getRetailLocationRequests());
});

app.put("/api/retail-locations/requests/:id/approve", async (req, res) => {
  const id = req.params.id;
  const requests = await getRetailLocationRequests();
  const item = requests.find((x) => x.id === id);
  if (!item) return res.status(404).json({ error: "Request not found" });
  const remaining = requests.filter((x) => x.id !== id);
  await setRetailLocationRequests(remaining);
  const locations = await getRetailLocations();
  const approved = { ...item, status: "approved", id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
  await setRetailLocations([approved, ...locations]);
  res.json(approved);
});

app.delete("/api/retail-locations/requests/:id", async (req, res) => {
  const id = req.params.id;
  const requests = await getRetailLocationRequests();
  await setRetailLocationRequests(requests.filter((x) => x.id !== id));
  res.json({ success: true });
});

app.get("/api/user-settings/:userId", async (req, res) => {
  res.json(await getUserSettings(req.params.userId));
});

app.put("/api/user-settings/:userId", async (req, res) => {
  res.json(await setUserSettings(req.params.userId, req.body || {}));
});

app.get("/api/promo-codes", async (_req, res) => {
  res.json(await getPromoCodes());
});

app.post("/api/promo-codes", async (req, res) => {
  const body = req.body || {};
  if (!body.code) return res.status(400).json({ error: "code is required" });
  const promoCodes = await getPromoCodes();
  const code = String(body.code).toUpperCase();
  const promo = { ...body, code };
  await setPromoCodes([promo, ...promoCodes.filter((x) => String(x.code).toUpperCase() !== code)]);
  res.status(201).json(promo);
});

app.put("/api/promo-codes/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const promoCodes = await getPromoCodes();
  const current = promoCodes.find((x) => String(x.code).toUpperCase() === code);
  if (!current) return res.status(404).json({ error: "Promo code not found" });
  const updated = { ...current, ...(req.body || {}), code };
  await setPromoCodes(promoCodes.map((x) => (String(x.code).toUpperCase() === code ? updated : x)));
  res.json(updated);
});

app.delete("/api/promo-codes/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const promoCodes = await getPromoCodes();
  await setPromoCodes(promoCodes.filter((x) => String(x.code).toUpperCase() !== code));
  res.json({ success: true });
});

app.post("/api/verify-promo", async (req, res) => {
  const code = String(req.body?.code || "").toUpperCase();
  const promoCodes = await getPromoCodes();
  const promo = promoCodes.find((x) => String(x.code).toUpperCase() === code);
  if (!promo) return res.status(404).json({ valid: false, error: "Промокод не найден" });
  if (promo.active === false) return res.status(400).json({ valid: false, error: "Промокод неактивен" });
  const discountPercent = Number(promo.discountPercent || promo.discount || 0);
  res.json({ valid: true, discountPercent });
});

app.get("/api/favorites/:userId", async (req, res) => {
  const map = await getFavoritesByUser();
  res.json(Array.isArray(map[req.params.userId]) ? map[req.params.userId] : []);
});

app.post("/api/favorites/:userId", async (req, res) => {
  const { userId } = req.params;
  const itemId = req.body?.itemId;
  if (!itemId) return res.status(400).json({ error: "itemId is required" });
  const map = await getFavoritesByUser();
  const current = Array.isArray(map[userId]) ? map[userId] : [];
  const favorites = current.includes(itemId) ? current : [...current, itemId];
  await setFavoritesByUser({ ...map, [userId]: favorites });
  res.json({ favorites });
});

app.delete("/api/favorites/:userId/:itemId", async (req, res) => {
  const { userId, itemId } = req.params;
  const map = await getFavoritesByUser();
  const current = Array.isArray(map[userId]) ? map[userId] : [];
  const favorites = current.filter((x) => x !== itemId);
  await setFavoritesByUser({ ...map, [userId]: favorites });
  res.json({ favorites });
});

app.get("/api/ticker-settings", async (req, res) => {
  const type = String(req.query.type || "wholesale");
  const settings = await getTickerSettings();
  res.json(settings?.[type] || settings?.wholesale || { enabled: true, text: "", speed: 30 });
});

app.put("/api/ticker-settings", async (req, res) => {
  const body = req.body || {};
  const type = body.type || "wholesale";
  const settings = await getTickerSettings();
  const updated = {
    ...settings,
    [type]: {
      ...(settings?.[type] || {}),
      ...body,
      type,
    },
  };
  await setTickerSettings(updated);
  res.json(updated[type]);
});

app.get("/api/retail/products", async (_req, res) => {
  const products = await getRetailProducts();
  res.json(products.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)));
});

/** Динамический sitemap: статические страницы + все опубликованные товары розницы (slug как на сайте). */
function xmlEscapeLoc(loc) {
  return String(loc)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.get("/api/sitemap.xml", async (_req, res) => {
  try {
    const base = String(process.env.FRONTEND_BASE_URL || "https://coffeenechai.ru").replace(/\/+$/, "");
    const lastmod = new Date().toISOString().slice(0, 10);
    const staticPaths = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/business", priority: "0.9", changefreq: "weekly" },
      { path: "/locations", priority: "0.8", changefreq: "weekly" },
      { path: "/harvest", priority: "0.7", changefreq: "weekly" },
      { path: "/privacy", priority: "0.3", changefreq: "monthly" },
      { path: "/agreement", priority: "0.3", changefreq: "monthly" },
      { path: "/marketing-consent", priority: "0.2", changefreq: "monthly" },
      { path: "/contacts", priority: "0.4", changefreq: "monthly" },
    ];

    const products = await getRetailProducts();
    const seenSlugs = new Set();
    const productUrls = [];

    for (const p of products) {
      if (!p || typeof p !== "object") continue;
      if (p.published === false) continue;
      const name = String(p.name || "").trim();
      if (!name) continue;
      let slug = transliterateProductName(name);
      if (!slug) slug = `item-${String(p.id || "").replace(/[^a-z0-9-]/gi, "").slice(-12) || "x"}`;
      if (seenSlugs.has(slug)) {
        slug = `${slug}-${String(p.id || "").replace(/[^a-z0-9-]/gi, "").slice(-6) || "id"}`;
      }
      seenSlugs.add(slug);
      productUrls.push({
        loc: `${base}/${slug}`,
        priority: "0.85",
        changefreq: "weekly",
      });
    }

    const urlNodes = [
      ...staticPaths.map(({ path: p, priority, changefreq }) => ({
        loc: p === "/" ? `${base}/` : `${base}${p}`,
        priority,
        changefreq,
      })),
      ...productUrls,
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urlNodes
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscapeLoc(u.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        )
        .join("\n") +
      `\n</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  } catch (e) {
    console.error("/api/sitemap.xml", e);
    res
      .status(500)
      .type("application/xml; charset=utf-8")
      .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  }
});

app.post("/api/retail/products", async (req, res) => {
  const body = req.body || {};
  const products = await getRetailProducts();
  const product = { ...body, id: body.id || `retail-product-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
  await setRetailProducts([...products.filter((x) => x.id !== product.id), product]);
  res.status(201).json(product);
});

app.put("/api/retail/products/:id", async (req, res) => {
  const { id } = req.params;
  const products = await getRetailProducts();
  const current = products.find((x) => x.id === id);
  if (!current) return res.status(404).json({ error: "Product not found" });
  const updated = { ...current, ...(req.body || {}), id };
  await setRetailProducts(products.map((x) => (x.id === id ? updated : x)));
  res.json(updated);
});

app.delete("/api/retail/products/:id", async (req, res) => {
  const products = await getRetailProducts();
  await setRetailProducts(products.filter((x) => x.id !== req.params.id));
  res.json({ success: true });
});

app.put("/api/retail/products/reorder", async (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  const products = await getRetailProducts();
  const map = new Map(updates.map((x) => [x.id, Number(x.displayOrder || 0)]));
  const next = products.map((x) => (map.has(x.id) ? { ...x, displayOrder: map.get(x.id) } : x));
  await setRetailProducts(next);
  res.json({ success: true });
});

app.post("/api/retail/products/migrate-dimensions", async (_req, res) => {
  const products = await getRetailProducts();
  let updatedProducts = 0;
  const next = products.map((p) => {
    const patch = { ...p };
    if (!Number.isFinite(Number(patch.packageWeight))) {
      patch.packageWeight = 250;
      updatedProducts += 1;
    }
    if (!Number.isFinite(Number(patch.packageLength))) patch.packageLength = 20;
    if (!Number.isFinite(Number(patch.packageHeight))) patch.packageHeight = 10;
    if (!Number.isFinite(Number(patch.packageWidth))) patch.packageWidth = 10;
    return patch;
  });
  await setRetailProducts(next);
  res.json({ success: true, totalProducts: products.length, updatedProducts, message: "Dimensions migrated" });
});

app.post("/api/retail/init-test-data", async (_req, res) => {
  const current = await getRetailProducts();
  if (current.length > 0) return res.json({ success: true, count: current.length });
  const seed = [
    { id: "retail-seed-1", name: "Brazil", price: 890, category: "Эспрессо", displayOrder: 1, published: true },
    { id: "retail-seed-2", name: "Ethiopia", price: 990, category: "Фильтр", displayOrder: 2, published: true },
  ];
  await setRetailProducts(seed);
  res.json({ success: true, count: seed.length });
});

app.post("/api/retail/upload-image", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  let origin = publicApiOrigin(req);
  if (!origin) {
    origin = String(
      process.env.FRONTEND_BASE_URL || process.env.ALLOWED_ORIGIN || `http://127.0.0.1:${port}`,
    ).replace(/\/+$/, "");
  }
  const url = `${origin}/api/uploads/${req.file.filename}`;

  res.status(201).json({
    success: true,
    url,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

app.get("/api/retail/category-order", async (_req, res) => {
  const order = await getCategoryOrder();
  res.json({ order: order.length ? order : DEFAULT_CATEGORY_ORDER });
});

app.put("/api/retail/category-order", async (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  await setCategoryOrder(order.length ? order : DEFAULT_CATEGORY_ORDER);
  res.json({ success: true });
});

app.get("/api/retail/orders", async (_req, res) => {
  const data = (await getRetailOrders()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  res.json(data);
});

app.get("/api/retail/orders/my/:userId", async (req, res) => {
  const { userId } = req.params;
  const data = (await getRetailOrders()).filter((order) => order.userId === userId || order.user_id === userId);
  res.json(data);
});

app.get("/api/retail/orders/:orderId", async (req, res) => {
  const order = await getRetailOrderById(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Retail order not found" });
  res.json(order);
});

app.delete("/api/retail/orders/:orderId", async (req, res) => {
  const removed = await deleteRetailOrderById(req.params.orderId);
  if (!removed) return res.status(404).json({ error: "Retail order not found" });
  res.json({ success: true });
});

app.post("/api/retail/checkout/pay", async (req, res) => {
  const body = req.body || {};
  const orderId = body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const existing = await getRetailOrderById(orderId);
  const total =
    body.total ||
    (Array.isArray(body.cart)
      ? body.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0)
      : 0);

  const order =
    existing ||
    await addRetailOrder({
      orderId,
      date: new Date().toISOString(),
      orderType: "retail",
      paymentStatus: "pending",
      email: body.email,
      phone: body.phone,
      total,
      items: body.cart || body.items || [],
    });

  const frontendBase = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
  const paymentLink = `${frontendBase}/payment-success?order_id=${encodeURIComponent(order.orderId)}`;
  await updateRetailOrderById(order.orderId, { paymentLink, paymentStatus: "pending" });

  res.json({
    success: true,
    orderId: order.orderId,
    paymentLink,
  });
});

app.get("/api/retail/order-payment-info/:orderId", async (req, res) => {
  const order = (await getRetailOrderById(req.params.orderId)) || (await getOrderById(req.params.orderId));
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({
    orderId: order.orderId,
    total: order.total,
    paymentStatus: order.paymentStatus || order.payment_status || "pending",
    paymentLink: order.paymentLink || order.tochka_payment_url,
    status: order.status || "new",
  });
});

app.get("/api/cdek/cities", async (req, res) => {
  try {
    const data = await searchCities(req.query.q || "");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to search cities", cities: [] });
  }
});

app.post("/api/cdek/pvz", async (req, res) => {
  try {
    const data = await getPickupPoints(req.body || {});
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to load pickup points", pickup_points: [] });
  }
});

app.post("/api/cdek/calc", async (req, res) => {
  try {
    const data = await calculateDelivery(req.body || {});
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to calculate delivery cost" });
  }
});

app.get("/api/tochka/acquiring/test-token", (_req, res) => {
  const hasToken = Boolean((process.env.TOCHKA_JWT_TOKEN || "").trim());
  const hasCustomer = Boolean((process.env.TOCHKA_CUSTOMER_CODE || "").trim());
  const hasMerchant = Boolean((process.env.TOCHKA_MERCHANT_ID || "").trim());
  const hasTerminal = Boolean((process.env.TOCHKA_TERMINAL_ID || "").trim());
  const hasClientId = Boolean((process.env.TOCHKA_CLIENT_ID || "").trim());
  res.json({
    hasToken,
    hasCustomer,
    hasMerchant,
    hasTerminal,
    hasClientId,
    /** Без terminalId payments_with_receipt не вернёт ссылку на оплату. */
    acquiringReady: hasToken && hasCustomer && hasMerchant && hasTerminal,
  });
});

app.post("/api/tochka/create-invoice", async (req, res) => {
  const { orderId, amount, purpose } = req.body || {};
  const jwtToken = process.env.TOCHKA_JWT_TOKEN;
  const customerCode = process.env.TOCHKA_CUSTOMER_CODE;
  const merchantId = process.env.TOCHKA_MERCHANT_ID;
  const terminalId = process.env.TOCHKA_TERMINAL_ID;

  if (!jwtToken || !customerCode) {
    return res.status(500).json({
      success: false,
      error: "Tochka env is not configured",
    });
  }

  const order = (await getOrderById(orderId)) || (await getRetailOrderById(orderId));
  const finalAmount = amount || order?.total;
  if (!orderId || !finalAmount) {
    return res.status(400).json({
      success: false,
      error: "orderId is required and amount must exist in body or stored order",
    });
  }

  if (!merchantId?.trim() || !terminalId?.trim()) {
    return res.status(500).json({
      success: false,
      error: "TOCHKA_MERCHANT_ID и TOCHKA_TERMINAL_ID обязательны для payments_with_receipt",
    });
  }

  try {
    const orderForReceipt =
      order && Array.isArray(order.items) && order.items.length > 0
        ? { ...order, total: Number(order.total) || Number(finalAmount) }
        : {
            orderId,
            total: Number(finalAmount),
            contact: order?.contact || order?.company || "Покупатель",
            email: order?.email || "no-reply@coffeenechai.ru",
            phone: order?.phone || process.env.TOCHKA_RECEIPT_FALLBACK_PHONE || "",
            items: [
              {
                name: String(purpose || `Заказ ${orderId}`).slice(0, 255),
                quantity: 1,
                subtotal: Number(finalAmount),
              },
            ],
            delivery_cost: 0,
          };

    const ph = tochkaClientPhone(orderForReceipt.phone);
    if (!ph) {
      return res.status(400).json({
        success: false,
        error:
          "Для оплаты с чеком нужен телефон в заказе или в .env TOCHKA_RECEIPT_FALLBACK_PHONE (10–11 цифр, РФ).",
      });
    }

    const dataPayload = buildPaymentsWithReceiptData(
      { ...orderForReceipt, phone: ph },
      { purpose: purpose || `Заказ ${orderId}`, orderId: String(orderId).trim() },
    );

    const { response, data } = await fetchPaymentsWithReceipt(dataPayload);
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to create Tochka invoice",
        details: data,
      });
    }

    const paymentLink = extractPaymentLink(data);
    const invoiceId = extractOperationId(data) || paymentLink || `INV-${orderId}`;
    const updates = {
      invoiceId,
      invoiceCreatedAt: new Date().toISOString(),
      paymentLink,
      paymentStatus: "pending",
      tochkaStatusRaw: data,
    };
    const updated =
      (await updateRetailOrderById(orderId, updates)) ||
      (await updateOrderById(orderId, updates));

    return res.json({
      success: true,
      invoiceId,
      invoiceCreatedAt: updates.invoiceCreatedAt,
      paymentLink,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Tochka request failed",
    });
  }
});

app.post(
  "/api/tochka/webhook",
  express.text({ type: "*/*", limit: "256kb" }),
  async (req, res) => {
    // Точка шлёт text/plain: тело = JWT (RS256). См. acquiringInternetPayment.
    // Всегда 200, иначе до 30 повторов с шагом 10 с.
    let payload = {};
    const raw = typeof req.body === "string" ? req.body.trim() : "";
    try {
      if (raw && raw.split(".").length === 3) {
        payload = await verifyTochkaWebhookJwt(raw);
      } else if (raw.startsWith("{")) {
        payload = JSON.parse(raw);
      } else if (raw) {
        console.warn("[tochka webhook] unexpected body (not JWT / JSON), length", raw.length);
      }
    } catch (e) {
      console.error("[tochka webhook] parse/verify failed:", e?.message || e);
      return res.status(200).send("OK");
    }

    try {
      const data = payload && typeof payload.Data === "object" && payload.Data != null ? payload.Data : {};
      const webhookType = String(payload.webhookType || data.webhookType || "").toLowerCase();
      const requestId =
        payload.requestId ||
        payload.operationId ||
        data.requestId ||
        data.operationId ||
        data.RequestId ||
        data.OperationId;
      const paymentLinkIdRaw =
        payload.paymentLinkId ??
        payload.paymentLinkID ??
        data.paymentLinkId ??
        data.paymentLinkID ??
        data.PaymentLinkId;
      const paymentLinkId = paymentLinkIdRaw != null && String(paymentLinkIdRaw).trim() !== "" ? String(paymentLinkIdRaw) : "";
      const externalOrderId =
        paymentLinkId ||
        payload.orderId ||
        data.orderId ||
        data.OrderId ||
        data.metadata?.orderId ||
        "";

      const statusUpper = String(
        payload.status ||
          data.status ||
          data.Status ||
          payload.paymentStatus ||
          data.paymentStatus ||
          "",
      ).toUpperCase();
      const statusLower = statusUpper.toLowerCase();

      let statusMapped = "pending";
      if (webhookType === "acquiringinternetpayment") {
        if (statusUpper === "APPROVED") statusMapped = "paid";
        else if (statusUpper === "AUTHORIZED") statusMapped = "pending";
        else if (["FAILED", "DECLINED", "CANCELLED", "CANCELED"].includes(statusUpper)) statusMapped = "failed";
      } else {
        if (["paid", "success", "completed", "authorized", "done", "approved"].includes(statusLower)) statusMapped = "paid";
        if (["failed", "error", "declined"].includes(statusLower)) statusMapped = "failed";
        if (["cancelled", "canceled"].includes(statusLower)) statusMapped = "cancelled";
      }

      let orderId = externalOrderId ? String(externalOrderId).trim() : "";
      if (!orderId && requestId && String(requestId).startsWith("PAY-")) {
        orderId = String(requestId).slice(4);
      }

      if (!orderId) {
        console.warn("[tochka webhook] orderId not resolved", {
          webhookType,
          payloadKeys: Object.keys(payload || {}),
          dataKeys: Object.keys(data || {}),
        });
      }

      if (orderId) {
        const before =
          (await getRetailOrderById(orderId)) || (await getOrderById(orderId));
        const prevPaid = ["paid", "success", "completed"].includes(
          String(before?.paymentStatus || before?.payment_status || "").toLowerCase(),
        );
        const updates = {
          paymentStatus: statusMapped,
          payment_status: statusMapped,
          paidAt: statusMapped === "paid" ? new Date().toISOString() : undefined,
          tochkaWebhookAt: new Date().toISOString(),
          tochkaWebhookPayload: payload,
        };
        (await updateRetailOrderById(orderId, updates)) || (await updateOrderById(orderId, updates));
        if (statusMapped === "paid" && before && !prevPaid) {
          const after =
            (await getRetailOrderById(orderId)) || (await getOrderById(orderId));
          if (after) void telegramNotify("payment_received", formatPaymentReceived(after));
        }
      }

      return res.status(200).send("OK");
    } catch (_error) {
      return res.status(200).send("OK");
    }
  },
);

app.post("/api/retail/check-pending-payments", async (_req, res) => {
  // Placeholder for scheduled reconciliation.
  // The final version will query Tochka status API per pending order.
  const pendingOrders = await getPendingRetailOrders();
  return res.json({
    checked: pendingOrders.length,
    updated: 0,
    pendingOrderIds: pendingOrders.map((order) => order.orderId),
  });
});

app.get("/api/retail/loyalty/claim-status/:userId", async (req, res) => {
  const loyalty = await getRetailLoyalty(req.params.userId);
  res.json({ claimed: Boolean(loyalty?.bonusClaimedAt), bonusClaimedAt: loyalty?.bonusClaimedAt || null });
});

app.get("/api/admin/orders", async (_req, res) => {
  res.json((await getOrders()).sort(byDateDesc));
});

app.get("/api/admin/retail/orders", async (_req, res) => {
  res.json((await getRetailOrders()).sort(byDateDesc));
});

app.get("/api/admin/users", async (_req, res) => {
  res.json(sanitizeUsers(await getUsers()));
});

/** Полный JSON опта + розницы для ручного бэкапа (товары, заказы, пользователи, промокоды, лояльность и т.д.). */
app.get("/api/admin/full-export", async (_req, res) => {
  try {
    const snapshot = await getFullDatabaseSnapshot();
    res.json(snapshot);
  } catch (e) {
    console.error("[admin/full-export]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/admin/users/:id/orders", async (req, res) => {
  const { id } = req.params;
  const wholesale = (await getOrders()).filter((o) => o.userId === id || o.user_id === id);
  const retail = (await getRetailOrders()).filter((o) => o.userId === id || o.user_id === id);
  res.json([...wholesale, ...retail].sort(byDateDesc));
});

app.get("/api/retail-users", async (_req, res) => {
  res.json({ users: sanitizeUsers(await getRetailUsers()) });
});

app.post("/api/retail-users", async (req, res) => {
  const body = req.body || {};
  const users = await getRetailUsers();
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Укажите email" });
  }
  if (users.some((x) => String(x.email || "").toLowerCase() === email)) {
    return res.status(409).json({ error: "Пользователь с таким email уже есть" });
  }
  const createdAt = body.createdAt || body.created_at || new Date().toISOString();
  const user = {
    ...body,
    id: body.id || `retail-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: String(body.email).trim(),
    role: String(body.role || "user"),
    createdAt,
  };
  await setRetailUsers([user, ...users.filter((x) => x.id !== user.id)]);
  const loyalty = await getRetailLoyalty(user.id);
  void telegramNotify("retail_user_admin", formatNewRetailUserCreated(user, loyalty)).catch((e) =>
    console.error("[retail-users POST] telegram", e),
  );
  const safe = sanitizeUser(user);
  res.status(201).json({
    user: { ...safe, created_at: user.createdAt || user.created_at || createdAt },
  });
});

app.delete("/api/retail-users/:id", async (req, res) => {
  const users = await getRetailUsers();
  await setRetailUsers(users.filter((x) => x.id !== req.params.id));
  res.json({ success: true });
});

app.post("/api/retail-users/:userId/add-points", async (req, res) => {
  const { userId } = req.params;
  const points = Number(req.body?.points || 0);
  const users = await getRetailUsers();
  const current = users.find((x) => x.id === userId);
  if (!current) return res.status(404).json({ error: "Retail user not found" });
  const updated = { ...current, bonusPoints: Number(current.bonusPoints || 0) + points };
  await setRetailUsers(users.map((x) => (x.id === userId ? updated : x)));
  res.json(sanitizeUser(updated));
});

app.post("/api/admin/retail-users/:id/balance", async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body?.amount || 0);
  const users = await getRetailUsers();
  const current = users.find((x) => x.id === id);
  if (!current) return res.status(404).json({ error: "Retail user not found" });
  const updated = { ...current, bonusPoints: Number(current.bonusPoints || 0) + amount };
  await setRetailUsers(users.map((x) => (x.id === id ? updated : x)));
  res.json(sanitizeUser(updated));
});

app.post("/api/business-registration", async (req, res) => {
  const body = req.body || {};
  const { status: _statusFromClient, ...rest } = body;
  const items = await getBusinessRegistrations();
  const item = {
    id: `biz-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...rest,
  };
  await setBusinessRegistrations([item, ...items]);
  await telegramNotify("business_registration", formatBusinessRegistration(item));
  res.status(201).json({ success: true, registration: item });
});

app.get("/api/business-registrations", async (_req, res) => {
  const registrations = await getBusinessRegistrations();
  res.json({ registrations });
});

app.patch("/api/business-registration/:id/status", async (req, res) => {
  const { status } = req.body || {};
  const allowed = new Set(["pending", "processed", "rejected"]);
  if (!allowed.has(String(status || ""))) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const items = await getBusinessRegistrations();
  const ix = items.findIndex((x) => x.id === req.params.id);
  if (ix === -1) return res.status(404).json({ error: "Not found" });
  const updated = { ...items[ix], status };
  const next = items.map((x, i) => (i === ix ? updated : x));
  await setBusinessRegistrations(next);
  res.json({ success: true, registration: updated });
});

app.delete("/api/business-registration/:id", async (req, res) => {
  const items = await getBusinessRegistrations();
  await setBusinessRegistrations(items.filter((x) => x.id !== req.params.id));
  res.json({ success: true });
});

app.post("/api/utilities/find-orders-by-total", async (req, res) => {
  const totals = Array.isArray(req.body?.totals) ? req.body.totals.map(Number) : [];
  const wholesale = (await getOrders())
    .filter((x) => totals.includes(Number(x.total)))
    .map((x) => ({ ...x, _key: `orders:${x.orderId}` }));
  const retail = (await getRetailOrders())
    .filter((x) => totals.includes(Number(x.total)))
    .map((x) => ({ ...x, _key: `retailOrders:${x.orderId}` }));
  res.json({ wholesale, retail, misplaced: [] });
});

app.post("/api/utilities/delete-order-by-key", async (req, res) => {
  const key = String(req.body?.key || "");
  if (key.startsWith("orders:")) {
    await deleteOrderById(key.replace("orders:", ""));
  } else if (key.startsWith("retailOrders:")) {
    await deleteRetailOrderById(key.replace("retailOrders:", ""));
  } else {
    return res.status(400).json({ error: "Unsupported key" });
  }
  res.json({ success: true, deletedKey: key });
});

app.post("/api/utilities/delete-orders-by-keys", async (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
  const deleted = [];
  const failed = [];
  for (const key of keys) {
    try {
      if (String(key).startsWith("orders:")) {
        await deleteOrderById(String(key).replace("orders:", ""));
      } else if (String(key).startsWith("retailOrders:")) {
        await deleteRetailOrderById(String(key).replace("retailOrders:", ""));
      } else {
        throw new Error("Unsupported key");
      }
      deleted.push(key);
    } catch (error) {
      failed.push({ key, error: error.message || "failed" });
    }
  }
  res.json({ deleted, failed });
});

app.get("/api/utilities/list-all-order-keys", async (_req, res) => {
  const wholesale = (await getOrders()).map((x) => ({ key: `orders:${x.orderId}`, orderId: x.orderId, total: x.total }));
  const retail = (await getRetailOrders()).map((x) => ({
    key: `retailOrders:${x.orderId}`,
    orderId: x.orderId,
    total: x.total,
  }));
  res.json({
    wholesale,
    retail,
    problematic: [],
    summary: { wholesaleCount: wholesale.length, retailCount: retail.length, problematicCount: 0 },
  });
});

app.post("/api/backup/send-email", async (_req, res) => {
  try {
    await runWeeklyEmailBackupScript();
    res.json({
      success: true,
      message: "Backup created and sent to email",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup/send-email]", msg);
    res.status(500).json({
      error: "Failed to create or send backup",
      details: msg,
    });
  }
});

app.use((error, _req, res, next) => {
  if (!error) return next();
  if (error instanceof multer.MulterError || error.message === "Only image files are allowed") {
    return res.status(400).json({ error: error.message });
  }
  return next(error);
});

registerDebugRoutes(app);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "API route not found",
  });
});

initStorage()
  .then(seedDefaultAdmin)
  .then(() => {
    app.listen(port, () => {
      console.log(`[site-api] listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  });
