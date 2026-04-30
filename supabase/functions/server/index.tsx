// v2 - restore endpoint added
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const prefix = "/make-server-aa167a09";

app.use("*", logger(console.log));
app.use("/*", cors({ origin: "*" }));

// ─── helpers ────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const ADMIN_API_TOKEN = Deno.env.get("ADMIN_API_TOKEN") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
const DADATA_API_KEY = Deno.env.get("DADATA_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TOCHKA_JWT_TOKEN = Deno.env.get("TOCHKA_JWT_TOKEN") || "";
const TOCHKA_CUSTOMER_CODE = Deno.env.get("TOCHKA_CUSTOMER_CODE") || "";
const TOCHKA_MERCHANT_ID = Deno.env.get("TOCHKA_MERCHANT_ID") || "";
const TOCHKA_TERMINAL_ID = Deno.env.get("TOCHKA_TERMINAL_ID") || "";

const adminSupabase = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const logErr = (ctx: string, err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : "";
  console.log(`❌ [${ctx}]`, msg, stack);
};

const newId = (prefix = "") =>
  `${prefix}${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const requireAdmin = (c: any) => {
  const tok = c.req.header("x-admin-token") || "";
  if (!ADMIN_API_TOKEN) return true; // if not configured, allow (compat)
  return tok === ADMIN_API_TOKEN;
};

const getBearer = (c: any) => {
  const auth = c.req.header("Authorization") || c.req.header("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
};

const getAuthUser = async (c: any) => {
  const token = getBearer(c);
  if (!token || token === ANON_KEY) return null;
  try {
    const sup = adminSupabase();
    const { data, error } = await sup.auth.getUser(token);
    if (error) return null;
    return data.user;
  } catch (err) {
    logErr("getAuthUser", err);
    return null;
  }
};

const sendTelegram = async (text: string) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ Telegram not configured");
    return;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    if (!res.ok) console.log("Telegram send failed:", await res.text());
  } catch (err) {
    logErr("sendTelegram", err);
  }
};

const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  from = "Nechai Coffee <noreply@nechai.coffee>",
) => {
  if (!RESEND_API_KEY) {
    console.log("⚠️ Resend not configured");
    return null;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.log("Resend failed:", await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    logErr("sendEmail", err);
    return null;
  }
};

// ─── health ─────────────────────────────────────────────────────────────────
app.get(`${prefix}/health`, (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString(), service: "make-server-aa167a09" }),
);

app.get(`${prefix}/keep-alive`, (c) =>
  c.json({ alive: true, timestamp: new Date().toISOString() }),
);

// ─── COFFEE ITEMS ───────────────────────────────────────────────────────────
app.get(`${prefix}/coffee-items`, async (c) => {
  try {
    const items = await kv.getByPrefix("coffee:item:");
    return c.json(items.filter((i: any) => i?.published !== false));
  } catch (err) {
    logErr("coffee-items GET", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/coffee-items-admin`, async (c) => {
  try {
    const items = await kv.getByPrefix("coffee:item:");
    return c.json(items);
  } catch (err) {
    logErr("coffee-items-admin", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/coffee-items`, async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || newId();
    const item = { ...body, id };
    await kv.set(`coffee:item:${id}`, item);
    return c.json(item);
  } catch (err) {
    logErr("coffee-items POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/coffee-items/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const cur = (await kv.get(`coffee:item:${id}`)) || { id };
    const merged = { ...cur, ...updates, id };
    await kv.set(`coffee:item:${id}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("coffee-items PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/coffee-items/:id`, async (c) => {
  try {
    await kv.del(`coffee:item:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("coffee-items DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/coffee-items-reorder`, async (c) => {
  try {
    const { items } = await c.req.json();
    if (Array.isArray(items)) {
      const keys = items.map((i: any) => `coffee:item:${i.id}`);
      await kv.mset(keys, items);
    }
    return c.json({ success: true });
  } catch (err) {
    logErr("coffee-items-reorder", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── ORDERS (wholesale) ─────────────────────────────────────────────────────
app.post(`${prefix}/orders`, async (c) => {
  try {
    const body = await c.req.json();
    const orderId = body.orderId || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = {
      orderId,
      date: new Date().toISOString(),
      orderType: "wholesale",
      ...body,
    };
    await kv.set(`order:${orderId}`, order);
    sendTelegram(
      `🛒 Новый оптовый заказ ${orderId}\nКомпания: ${order.company || "—"}\nКонтакт: ${order.contact || "—"}\nТелефон: ${order.phone || "—"}\nСумма: ${order.total || 0} ₽`,
    );
    return c.json(order);
  } catch (err) {
    logErr("orders POST", err);
    return c.json({ error: "Failed to create order" }, 500);
  }
});
app.get(`${prefix}/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix("order:");
    return c.json(
      orders.sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );
  } catch (err) {
    logErr("orders GET", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/orders/:orderId`, async (c) => {
  try {
    const o = await kv.get(`order:${c.req.param("orderId")}`);
    if (!o) return c.json({ error: "Not found" }, 404);
    return c.json(o);
  } catch (err) {
    logErr("orders GET id", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/orders/:orderId`, async (c) => {
  try {
    await kv.del(`order:${c.req.param("orderId")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("orders DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── ADMIN orders ───────────────────────────────────────────────────────────
app.get(`${prefix}/admin/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix("order:");
    return c.json(
      orders.sort((a: any, b: any) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      ),
    );
  } catch (err) {
    logErr("admin/orders", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/admin/retail/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix("retail:order:");
    return c.json(
      orders.sort((a: any, b: any) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      ),
    );
  } catch (err) {
    logErr("admin/retail/orders", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/admin/users`, async (c) => {
  try {
    const users = await kv.getByPrefix("user:");
    return c.json(users);
  } catch (err) {
    logErr("admin/users", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/admin/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param("id");
    const orders = await kv.getByPrefix("order:");
    return c.json(orders.filter((o: any) => o.userId === userId));
  } catch (err) {
    logErr("admin/users/:id/orders", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── EXCHANGE RATE ──────────────────────────────────────────────────────────
app.get(`${prefix}/exchange-rate`, async (c) => {
  try {
    const r = (await kv.get("exchange_rate")) || { usd_to_rub: 95 };
    return c.json(r);
  } catch (err) {
    logErr("exchange-rate GET", err);
    return c.json({ usd_to_rub: 95 });
  }
});
app.put(`${prefix}/exchange-rate`, async (c) => {
  try {
    const body = await c.req.json();
    const r = { usd_to_rub: body.usd_to_rub, updated_at: new Date().toISOString() };
    await kv.set("exchange_rate", r);
    return c.json(r);
  } catch (err) {
    logErr("exchange-rate PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── USERS (wholesale) ──────────────────────────────────────────────────────
app.get(`${prefix}/users`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("user:"));
  } catch (err) {
    logErr("users GET", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/users`, async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || newId("u-");
    const user = { ...body, id, created_at: new Date().toISOString() };
    await kv.set(`user:${id}`, user);
    return c.json(user);
  } catch (err) {
    logErr("users POST", err);
    return c.json({ error: "Failed to create user" }, 500);
  }
});
app.put(`${prefix}/users/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const cur = (await kv.get(`user:${id}`)) || { id };
    const merged = { ...cur, ...updates, id };
    await kv.set(`user:${id}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("users PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/users/:id`, async (c) => {
  try {
    await kv.del(`user:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("users DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/users/login`, async (c) => {
  try {
    const { phone, password } = await c.req.json();
    const users = await kv.getByPrefix("user:");
    const u = users.find((x: any) => x.phone === phone && x.password === password);
    if (!u) return c.json({ error: "Invalid credentials" }, 401);
    return c.json(u);
  } catch (err) {
    logErr("users/login", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/users/:id/orders`, async (c) => {
  try {
    const userId = c.req.param("id");
    const orders = await kv.getByPrefix("order:");
    return c.json(orders.filter((o: any) => o.userId === userId));
  } catch (err) {
    logErr("users/:id/orders", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/users/:id/loyalty`, async (c) => {
  try {
    const id = c.req.param("id");
    const profile = (await kv.get(`user:${id}`)) || {};
    const orders = (await kv.getByPrefix("order:")).filter((o: any) => o.userId === id);
    const totalKg = orders.reduce((sum: number, o: any) => sum + (o.totalKg || 0), 0);
    const loyaltyLevel = profile.loyaltyLevel ?? 0;
    const discount = profile.discount ?? 0;
    return c.json({
      loyaltyLevel,
      discount,
      loyaltyLevelSetDate: profile.loyaltyLevelSetDate || "",
      totalKg,
      ordersIn3Mo: 0,
      ordersIn6Mo: 0,
      ordersIn12Mo: 0,
      autoLevel: loyaltyLevel,
      autoDiscount: discount,
      isManualOverride: !!profile.isManualOverride,
      nextLevel: null,
    });
  } catch (err) {
    logErr("users/loyalty", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── PROMO CODES ────────────────────────────────────────────────────────────
app.get(`${prefix}/promo-codes`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("promo:"));
  } catch (err) {
    logErr("promo-codes GET", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/promo-codes`, async (c) => {
  try {
    const body = await c.req.json();
    await kv.set(`promo:${body.code}`, body);
    return c.json(body);
  } catch (err) {
    logErr("promo-codes POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/promo-codes/:code`, async (c) => {
  try {
    const code = c.req.param("code");
    const updates = await c.req.json();
    const cur = (await kv.get(`promo:${code}`)) || { code };
    const merged = { ...cur, ...updates, code };
    await kv.set(`promo:${code}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("promo-codes PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/promo-codes/:code`, async (c) => {
  try {
    await kv.del(`promo:${c.req.param("code")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("promo-codes DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/verify-promo`, async (c) => {
  try {
    const { code } = await c.req.json();
    const p = await kv.get(`promo:${code}`);
    if (!p) return c.json({ valid: false, error: "Promo code not found" }, 404);
    if (p.active === false) return c.json({ valid: false, error: "Promo inactive" }, 400);
    if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now())
      return c.json({ valid: false, error: "Promo expired" }, 400);
    return c.json({ valid: true, discountPercent: p.discountPercent || 0 });
  } catch (err) {
    logErr("verify-promo", err);
    return c.json({ valid: false, error: "Network error" }, 500);
  }
});

// ─── FAVORITES ──────────────────────────────────────────────────────────────
app.get(`${prefix}/favorites/:userId`, async (c) => {
  try {
    const f = (await kv.get(`favorites:${c.req.param("userId")}`)) || [];
    return c.json(f);
  } catch (err) {
    logErr("favorites GET", err);
    return c.json([]);
  }
});
app.post(`${prefix}/favorites/:userId`, async (c) => {
  try {
    const userId = c.req.param("userId");
    const { itemId } = await c.req.json();
    const cur: string[] = (await kv.get(`favorites:${userId}`)) || [];
    if (!cur.includes(itemId)) cur.push(itemId);
    await kv.set(`favorites:${userId}`, cur);
    return c.json({ favorites: cur });
  } catch (err) {
    logErr("favorites POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/favorites/:userId/:itemId`, async (c) => {
  try {
    const userId = c.req.param("userId");
    const itemId = c.req.param("itemId");
    const cur: string[] = (await kv.get(`favorites:${userId}`)) || [];
    const next = cur.filter((x) => x !== itemId);
    await kv.set(`favorites:${userId}`, next);
    return c.json({ favorites: next });
  } catch (err) {
    logErr("favorites DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── RETAIL PRODUCTS ────────────────────────────────────────────────────────
app.get(`${prefix}/retail/products`, async (c) => {
  try {
    const items = await kv.getByPrefix("retail:product:");
    return c.json(
      items.sort(
        (a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0),
      ),
    );
  } catch (err) {
    logErr("retail/products GET", err);
    return c.json([]);
  }
});
app.post(`${prefix}/retail/products`, async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || newId("p-");
    const product = { ...body, id };
    await kv.set(`retail:product:${id}`, product);
    return c.json(product);
  } catch (err) {
    logErr("retail/products POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/retail/products/reorder`, async (c) => {
  try {
    const { updates } = await c.req.json();
    for (const u of updates || []) {
      const cur = await kv.get(`retail:product:${u.id}`);
      if (cur) {
        cur.displayOrder = u.displayOrder;
        await kv.set(`retail:product:${u.id}`, cur);
      }
    }
    return c.json({ success: true });
  } catch (err) {
    logErr("retail/products/reorder", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/retail/products/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const cur = (await kv.get(`retail:product:${id}`)) || { id };
    const merged = { ...cur, ...updates, id };
    await kv.set(`retail:product:${id}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("retail/products PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/retail/products/:id`, async (c) => {
  try {
    await kv.del(`retail:product:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail/products DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/products/migrate-dimensions`, async (c) => {
  try {
    const items = await kv.getByPrefix("retail:product:");
    let updated = 0;
    for (const it of items) {
      if (!it.packageLength || !it.packageWidth || !it.packageHeight) {
        it.packageLength = it.packageLength || 20;
        it.packageWidth = it.packageWidth || 15;
        it.packageHeight = it.packageHeight || 10;
        it.packageWeight = it.packageWeight || 250;
        await kv.set(`retail:product:${it.id}`, it);
        updated++;
      }
    }
    return c.json({
      success: true,
      totalProducts: items.length,
      updatedProducts: updated,
      message: `Updated ${updated} of ${items.length} products`,
    });
  } catch (err) {
    logErr("migrate-dimensions", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/init-test-data`, async (c) => {
  try {
    const existing = await kv.getByPrefix("retail:product:");
    if (existing.length > 0) return c.json({ success: true, count: existing.length });
    const samples = [
      { id: "p-1", name: "Колумбия Уила", price: 850, imageUrl: "", description: "Колумбийский кофе", type: "bean", published: true },
      { id: "p-2", name: "Эфиопия Иргачиф", price: 950, imageUrl: "", description: "Эфиопский кофе", type: "bean", published: true },
    ];
    for (const s of samples) await kv.set(`retail:product:${s.id}`, s);
    return c.json({ success: true, count: samples.length });
  } catch (err) {
    logErr("retail/init-test-data", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/upload-image`, async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);
    const sup = adminSupabase();
    const bucket = "make-aa167a09-retail-images";
    try {
      await sup.storage.createBucket(bucket, { public: true });
    } catch (_) {}
    const path = `${Date.now()}-${file.name}`;
    const buf = await file.arrayBuffer();
    const { error } = await sup.storage.from(bucket).upload(path, buf, {
      contentType: file.type,
      upsert: true,
    });
    if (error) return c.json({ error: error.message }, 500);
    const { data } = sup.storage.from(bucket).getPublicUrl(path);
    return c.json({ url: data.publicUrl });
  } catch (err) {
    logErr("retail/upload-image", err);
    return c.json({ error: "Upload failed" }, 500);
  }
});
app.get(`${prefix}/retail/category-order`, async (c) => {
  try {
    const order = (await kv.get("retail:category_order")) || [];
    return c.json({ order });
  } catch (err) {
    logErr("category-order GET", err);
    return c.json({ order: [] });
  }
});
app.put(`${prefix}/retail/category-order`, async (c) => {
  try {
    const { order } = await c.req.json();
    await kv.set("retail:category_order", order);
    return c.json({ success: true });
  } catch (err) {
    logErr("category-order PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── RETAIL ORDERS ──────────────────────────────────────────────────────────
app.post(`${prefix}/retail/orders`, async (c) => {
  try {
    const body = await c.req.json();
    const orderId =
      body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = {
      orderId,
      date: body.date || new Date().toISOString(),
      orderType: "retail",
      ...body,
    };
    await kv.set(`retail:order:${orderId}`, order);
    sendTelegram(
      `🛍 Новый розничный заказ ${orderId}\nКлиент: ${order.contact || order.name || "—"}\nТелефон: ${order.phone || "—"}\nСумма: ${order.total || 0} ₽`,
    );
    return c.json(order);
  } catch (err) {
    logErr("retail/orders POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/retail/orders`, async (c) => {
  try {
    const orders = await kv.getByPrefix("retail:order:");
    return c.json(
      orders.sort(
        (a: any, b: any) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      ),
    );
  } catch (err) {
    logErr("retail/orders GET", err);
    return c.json([]);
  }
});
app.get(`${prefix}/retail/orders/my/:userId`, async (c) => {
  try {
    const userId = c.req.param("userId");
    const orders = await kv.getByPrefix("retail:order:");
    return c.json(orders.filter((o: any) => o.userId === userId || o.user_id === userId));
  } catch (err) {
    logErr("retail/orders/my", err);
    return c.json([]);
  }
});
app.get(`${prefix}/retail/orders/:orderId`, async (c) => {
  try {
    const o = await kv.get(`retail:order:${c.req.param("orderId")}`);
    if (!o) return c.json({ error: "Not found" }, 404);
    return c.json(o);
  } catch (err) {
    logErr("retail/orders GET id", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/retail/orders/:orderId`, async (c) => {
  try {
    await kv.del(`retail:order:${c.req.param("orderId")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail/orders DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── RETAIL USERS ───────────────────────────────────────────────────────────
app.get(`${prefix}/retail-users`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("retail:user:"));
  } catch (err) {
    logErr("retail-users GET", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail-users`, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, phone, name } = body;
    if (!email || !password)
      return c.json({ error: "email and password required" }, 400);
    const sup = adminSupabase();
    const { data, error } = await sup.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    });
    if (error) {
      logErr("createUser", error);
      return c.json({ error: error.message }, 400);
    }
    const id = data.user!.id;
    const profile = {
      id,
      email,
      phone,
      name,
      points: 0,
      created_at: new Date().toISOString(),
    };
    await kv.set(`retail:user:${id}`, profile);
    return c.json(profile);
  } catch (err) {
    logErr("retail-users POST", err);
    return c.json({ error: "Failed to create retail user" }, 500);
  }
});
app.delete(`${prefix}/retail-users/:userId`, async (c) => {
  try {
    const id = c.req.param("userId");
    try {
      await adminSupabase().auth.admin.deleteUser(id);
    } catch (_) {}
    await kv.del(`retail:user:${id}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail-users DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail-users/:userId/add-points`, async (c) => {
  try {
    const id = c.req.param("userId");
    const { points, reason } = await c.req.json();
    const u = (await kv.get(`retail:user:${id}`)) || { id, points: 0 };
    u.points = (u.points || 0) + (Number(points) || 0);
    u.lastPointsReason = reason;
    await kv.set(`retail:user:${id}`, u);
    return c.json(u);
  } catch (err) {
    logErr("retail-users/add-points", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── RETAIL SIGNUP ──────────────────────────────────────────────────────────
app.post(`${prefix}/retail-signup`, async (c) => {
  try {
    const { email, password, phone, name } = await c.req.json();
    if (!email || !password)
      return c.json({ error: "email and password required" }, 400);
    const sup = adminSupabase();
    const { data, error } = await sup.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    });
    if (error) return c.json({ error: error.message }, 400);
    const id = data.user!.id;
    const profile = {
      id,
      email,
      phone,
      name,
      points: 0,
      created_at: new Date().toISOString(),
    };
    await kv.set(`retail:user:${id}`, profile);
    sendTelegram(`👤 Новая регистрация: ${email} (${name || ""}, ${phone || ""})`);
    return c.json({ success: true, user: profile });
  } catch (err) {
    logErr("retail-signup", err);
    return c.json({ error: "Signup failed" }, 500);
  }
});

// ─── RETAIL LOYALTY ─────────────────────────────────────────────────────────
app.get(`${prefix}/retail/loyalty/:userId`, async (c) => {
  try {
    const id = c.req.param("userId");
    const u = (await kv.get(`retail:user:${id}`)) || {};
    return c.json({
      points: u.points || 0,
      bonusClaimedAt: u.bonusClaimedAt || null,
    });
  } catch (err) {
    logErr("retail/loyalty", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/loyalty/claim-bonus`, async (c) => {
  try {
    const { userId } = await c.req.json();
    const u = (await kv.get(`retail:user:${userId}`)) || { id: userId, points: 0 };
    u.points = (u.points || 0) + 100;
    u.bonusClaimedAt = new Date().toISOString();
    await kv.set(`retail:user:${userId}`, u);
    return c.json({ success: true, points: u.points });
  } catch (err) {
    logErr("loyalty/claim-bonus", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── BUSINESS REGISTRATION ──────────────────────────────────────────────────
app.post(`${prefix}/business-registration`, async (c) => {
  try {
    const body = await c.req.json();
    const id = newId("br-");
    const reg = { id, ...body, status: "pending", createdAt: new Date().toISOString() };
    await kv.set(`business:registration:${id}`, reg);
    sendTelegram(
      `🏢 Заявка на оптовый доступ\nКомпания: ${body.company || "—"}\nКонтакт: ${body.contact || "—"}\nТелефон: ${body.phone || "—"}`,
    );
    return c.json(reg);
  } catch (err) {
    logErr("business-registration POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/business-registrations`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("business:registration:"));
  } catch (err) {
    logErr("business-registrations GET", err);
    return c.json([]);
  }
});
app.patch(`${prefix}/business-registration/:id/status`, async (c) => {
  try {
    const id = c.req.param("id");
    const { status } = await c.req.json();
    const cur = (await kv.get(`business:registration:${id}`)) || { id };
    cur.status = status;
    await kv.set(`business:registration:${id}`, cur);
    return c.json(cur);
  } catch (err) {
    logErr("business-registration PATCH", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/business-registration/:id`, async (c) => {
  try {
    await kv.del(`business:registration:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("business-registration DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── WHOLESALE ACCESS ───────────────────────────────────────────────────────
app.post(`${prefix}/wholesale/request-access`, async (c) => {
  try {
    const body = await c.req.json();
    const id = newId("wa-");
    const r = { id, ...body, status: "pending", createdAt: new Date().toISOString() };
    await kv.set(`wholesale:request:${id}`, r);
    sendTelegram(
      `📨 Запрос доступа к опту\nКомпания: ${body.company || "—"}\nКонтакт: ${body.contact || "—"}\nТелефон: ${body.phone || "—"}`,
    );
    return c.json({ success: true, id });
  } catch (err) {
    logErr("wholesale/request-access", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── RETAIL LOCATIONS ───────────────────────────────────────────────────────
app.get(`${prefix}/retail-locations`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("retail:location:"));
  } catch (err) {
    logErr("retail-locations GET", err);
    return c.json([]);
  }
});
app.post(`${prefix}/retail-locations`, async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || newId("loc-");
    const loc = { ...body, id };
    await kv.set(`retail:location:${id}`, loc);
    return c.json(loc);
  } catch (err) {
    logErr("retail-locations POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/retail-locations/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const cur = (await kv.get(`retail:location:${id}`)) || { id };
    const merged = { ...cur, ...updates, id };
    await kv.set(`retail:location:${id}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("retail-locations PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/retail-locations/:id`, async (c) => {
  try {
    await kv.del(`retail:location:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail-locations DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/retail-locations`, async (c) => {
  try {
    const items = await kv.getByPrefix("retail:location:");
    const keys = items.map((i: any) => `retail:location:${i.id}`);
    if (keys.length) await kv.mdel(keys);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail-locations bulk DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail-locations/init`, async (c) => {
  try {
    const existing = await kv.getByPrefix("retail:location:");
    if (existing.length > 0) return c.json({ success: true, count: existing.length });
    const seeds = [
      { id: "loc-msk-1", city: "Москва", name: "Кофейня Nechai", address: "ул. Тверская, 1", phone: "" },
    ];
    for (const s of seeds) await kv.set(`retail:location:${s.id}`, s);
    return c.json({ success: true, count: seeds.length });
  } catch (err) {
    logErr("retail-locations/init", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail-locations/submit-request`, async (c) => {
  try {
    const body = await c.req.json();
    const id = newId("locreq-");
    const r = { id, ...body, status: "pending", createdAt: new Date().toISOString() };
    await kv.set(`retail:location:request:${id}`, r);
    sendTelegram(
      `📍 Заявка добавления точки: ${body.name || "—"}, ${body.city || "—"}, ${body.address || "—"}`,
    );
    return c.json({ success: true, id });
  } catch (err) {
    logErr("retail-locations/submit-request", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/retail-locations/requests`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("retail:location:request:"));
  } catch (err) {
    logErr("retail-locations/requests", err);
    return c.json([]);
  }
});
app.put(`${prefix}/retail-locations/requests/:id/approve`, async (c) => {
  try {
    const id = c.req.param("id");
    const req = await kv.get(`retail:location:request:${id}`);
    if (!req) return c.json({ error: "Not found" }, 404);
    const locId = newId("loc-");
    const loc = { ...req, id: locId, status: "approved" };
    await kv.set(`retail:location:${locId}`, loc);
    req.status = "approved";
    await kv.set(`retail:location:request:${id}`, req);
    return c.json(loc);
  } catch (err) {
    logErr("retail-locations/requests/approve", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/retail-locations/requests/:id`, async (c) => {
  try {
    await kv.del(`retail:location:request:${c.req.param("id")}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("retail-locations/requests DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── TICKER SETTINGS ────────────────────────────────────────────────────────
app.get(`${prefix}/ticker-settings`, async (c) => {
  try {
    const type = c.req.query("type") || "default";
    const t = (await kv.get(`ticker:${type}`)) || { enabled: false, text: "", speed: 30 };
    return c.json(t);
  } catch (err) {
    logErr("ticker-settings GET", err);
    return c.json({ enabled: false, text: "" });
  }
});
app.put(`${prefix}/ticker-settings`, async (c) => {
  try {
    const type = c.req.query("type") || "default";
    const body = await c.req.json();
    await kv.set(`ticker:${type}`, body);
    return c.json(body);
  } catch (err) {
    logErr("ticker-settings PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── USER SETTINGS ──────────────────────────────────────────────────────────
app.get(`${prefix}/user-settings/:userId`, async (c) => {
  try {
    const s = (await kv.get(`user:settings:${c.req.param("userId")}`)) || {};
    return c.json(s);
  } catch (err) {
    logErr("user-settings GET", err);
    return c.json({});
  }
});
app.put(`${prefix}/user-settings/:userId`, async (c) => {
  try {
    const id = c.req.param("userId");
    const body = await c.req.json();
    await kv.set(`user:settings:${id}`, body);
    return c.json(body);
  } catch (err) {
    logErr("user-settings PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── TELEGRAM ───────────────────────────────────────────────────────────────
app.post(`${prefix}/telegram-webhook`, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    console.log("telegram-webhook:", JSON.stringify(body).slice(0, 500));
    return c.json({ ok: true });
  } catch (err) {
    logErr("telegram-webhook", err);
    return c.json({ ok: false }, 500);
  }
});
app.get(`${prefix}/telegram/poll`, async (c) => {
  if (!TELEGRAM_BOT_TOKEN) return c.json({ error: "Not configured" }, 400);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
    return c.json(await res.json());
  } catch (err) {
    logErr("telegram/poll", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/telegram/webhook/setup`, async (c) => {
  if (!TELEGRAM_BOT_TOKEN) return c.json({ error: "Not configured" }, 400);
  try {
    const body = await c.req.json().catch(() => ({}));
    const url = body.url;
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(url || "")}`,
    );
    return c.json(await res.json());
  } catch (err) {
    logErr("telegram/webhook/setup", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/telegram/webhook/delete`, async (c) => {
  if (!TELEGRAM_BOT_TOKEN) return c.json({ error: "Not configured" }, 400);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
    return c.json(await res.json());
  } catch (err) {
    logErr("telegram/webhook/delete", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/telegram/webhook/info`, async (c) => {
  if (!TELEGRAM_BOT_TOKEN) return c.json({ error: "Not configured" }, 400);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    return c.json(await res.json());
  } catch (err) {
    logErr("telegram/webhook/info", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/telegram/webhook/test`, async (c) => {
  try {
    await sendTelegram("✅ Тестовое сообщение от make-server-aa167a09");
    return c.json({ ok: true });
  } catch (err) {
    logErr("telegram/webhook/test", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/broadcast`, async (c) => {
  try {
    const { text, image } = await c.req.json();
    const subs = (await kv.get("telegram:subscribers")) || [];
    let sent = 0;
    if (TELEGRAM_BOT_TOKEN) {
      for (const chatId of subs) {
        try {
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${image ? "sendPhoto" : "sendMessage"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                image
                  ? { chat_id: chatId, photo: image, caption: text }
                  : { chat_id: chatId, text },
              ),
            },
          );
          sent++;
        } catch (_) {}
      }
    }
    await kv.set(`broadcast:${Date.now()}`, { text, image, sent, total: subs.length });
    return c.json({ success: true, sent, total: subs.length });
  } catch (err) {
    logErr("broadcast", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/broadcast-stats`, async (c) => {
  try {
    const subs = (await kv.get("telegram:subscribers")) || [];
    const broadcasts = await kv.getByPrefix("broadcast:");
    return c.json({ subscribers: subs.length, broadcasts: broadcasts.length });
  } catch (err) {
    logErr("broadcast-stats", err);
    return c.json({ subscribers: 0, broadcasts: 0 });
  }
});
app.post(`${prefix}/upload-broadcast-image`, async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get("file") as File | null;
    if (!file) return c.json({ error: "No file" }, 400);
    const sup = adminSupabase();
    const bucket = "make-aa167a09-broadcast";
    try {
      await sup.storage.createBucket(bucket, { public: true });
    } catch (_) {}
    const path = `${Date.now()}-${file.name}`;
    const buf = await file.arrayBuffer();
    const { error } = await sup.storage.from(bucket).upload(path, buf, {
      contentType: file.type,
      upsert: true,
    });
    if (error) return c.json({ error: error.message }, 500);
    const { data } = sup.storage.from(bucket).getPublicUrl(path);
    return c.json({ url: data.publicUrl });
  } catch (err) {
    logErr("upload-broadcast-image", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/register-telegram`, async (c) => {
  try {
    const { chatId } = await c.req.json();
    const subs: any[] = (await kv.get("telegram:subscribers")) || [];
    if (!subs.includes(chatId)) {
      subs.push(chatId);
      await kv.set("telegram:subscribers", subs);
    }
    return c.json({ success: true });
  } catch (err) {
    logErr("register-telegram", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── DADATA PROXY ───────────────────────────────────────────────────────────
const dadataProxy = async (c: any, endpoint: string) => {
  try {
    const body = await c.req.json();
    const res = await fetch(`https://suggestions.dadata.ru/suggestions/api/4_1/rs/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return c.json({ error: await res.text() }, res.status);
    return c.json(await res.json());
  } catch (err) {
    logErr(`dadata/${endpoint}`, err);
    return c.json({ error: "Failed" }, 500);
  }
};
app.post(`${prefix}/dadata/suggest/party`, (c) => dadataProxy(c, "suggest/party"));
app.post(`${prefix}/dadata/findById/party`, (c) => dadataProxy(c, "findById/party"));
app.post(`${prefix}/dadata/suggest/address`, (c) => dadataProxy(c, "suggest/address"));
app.post(`${prefix}/dadata/suggest/bank`, (c) => dadataProxy(c, "suggest/bank"));

// ─── CDEK (stubs) ───────────────────────────────────────────────────────────
app.get(`${prefix}/cdek/cities`, (c) => c.json({ cities: [] }));
app.post(`${prefix}/cdek/calc`, (c) => c.json({ delivery_sum: 0, period_min: 1, period_max: 5 }));
app.post(`${prefix}/cdek/pvz`, (c) => c.json({ pvz: [] }));

// ─── TOCHKA ─────────────────────────────────────────────────────────────────
app.post(`${prefix}/tochka/create-invoice`, async (c) => {
  try {
    const { orderId } = await c.req.json();
    if (!orderId) return c.json({ success: false, error: "orderId required" }, 400);
    const order = (await kv.get(`retail:order:${orderId}`)) || (await kv.get(`order:${orderId}`));
    if (!order)
      return c.json({ success: false, error: "Order not found" }, 404);
    if (!TOCHKA_JWT_TOKEN || !TOCHKA_CUSTOMER_CODE) {
      const stub = {
        success: true,
        invoiceId: `STUB-${orderId}`,
        invoiceCreatedAt: new Date().toISOString(),
      };
      order.invoiceId = stub.invoiceId;
      order.invoiceCreatedAt = stub.invoiceCreatedAt;
      await kv.set(
        order.orderType === "retail" ? `retail:order:${orderId}` : `order:${orderId}`,
        order,
      );
      return c.json(stub);
    }
    try {
      const res = await fetch(
        "https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOCHKA_JWT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Data: {
              customerCode: TOCHKA_CUSTOMER_CODE,
              merchantId: TOCHKA_MERCHANT_ID,
              terminalId: TOCHKA_TERMINAL_ID,
              amount: String(order.total || 0),
              purpose: `Заказ ${orderId}`,
              redirectUrl: `${SUPABASE_URL}/functions/v1/make-server-aa167a09/payment-success?orderId=${orderId}`,
            },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        return c.json({ success: false, error: "Tochka error", details: JSON.stringify(data) }, 500);
      const invoiceId = data?.Data?.operationId || data?.Data?.paymentLink || newId("inv-");
      order.invoiceId = invoiceId;
      order.invoiceCreatedAt = new Date().toISOString();
      order.paymentLink = data?.Data?.paymentLink;
      await kv.set(
        order.orderType === "retail" ? `retail:order:${orderId}` : `order:${orderId}`,
        order,
      );
      return c.json({
        success: true,
        invoiceId,
        invoiceCreatedAt: order.invoiceCreatedAt,
        paymentLink: order.paymentLink,
      });
    } catch (err) {
      logErr("tochka/create-invoice fetch", err);
      return c.json({ success: false, error: "Network error" }, 500);
    }
  } catch (err) {
    logErr("tochka/create-invoice", err);
    return c.json({ success: false, error: "Failed" }, 500);
  }
});
app.get(`${prefix}/tochka/acquiring/test-token`, async (c) => {
  return c.json({
    hasToken: !!TOCHKA_JWT_TOKEN,
    hasCustomer: !!TOCHKA_CUSTOMER_CODE,
    hasMerchant: !!TOCHKA_MERCHANT_ID,
    hasTerminal: !!TOCHKA_TERMINAL_ID,
  });
});
app.post(`${prefix}/tochka/webhook`, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    console.log("tochka webhook:", JSON.stringify(body).slice(0, 500));
    const orderId = body?.orderId || body?.Data?.orderId;
    if (orderId) {
      const order = (await kv.get(`retail:order:${orderId}`)) || (await kv.get(`order:${orderId}`));
      if (order) {
        order.paymentStatus = body?.status || body?.Data?.status || "paid";
        order.paidAt = new Date().toISOString();
        await kv.set(
          order.orderType === "retail" ? `retail:order:${orderId}` : `order:${orderId}`,
          order,
        );
      }
    }
    return c.json({ ok: true });
  } catch (err) {
    logErr("tochka/webhook", err);
    return c.json({ ok: false }, 500);
  }
});
app.get(`${prefix}/payment-success`, (c) => {
  const url = new URL(c.req.url);
  const orderId = url.searchParams.get("orderId");
  return c.html(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Оплата успешна</title></head><body><script>location.href='/payment-success?orderId=${orderId || ""}';</script>Оплата успешна. Перенаправление...</body></html>`,
  );
});
app.get(`${prefix}/retail/order-payment-info/:orderId`, async (c) => {
  try {
    const id = c.req.param("orderId");
    const o = (await kv.get(`retail:order:${id}`)) || (await kv.get(`order:${id}`));
    if (!o) return c.json({ error: "Not found" }, 404);
    return c.json({
      orderId: id,
      total: o.total,
      paymentStatus: o.paymentStatus || "pending",
      invoiceId: o.invoiceId,
      paymentLink: o.paymentLink,
    });
  } catch (err) {
    logErr("order-payment-info", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/checkout/pay`, async (c) => {
  try {
    const body = await c.req.json();
    const order = body.order || body;
    const orderId = order.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const stored = {
      orderId,
      date: new Date().toISOString(),
      orderType: "retail",
      ...order,
      paymentStatus: "pending",
    };
    await kv.set(`retail:order:${orderId}`, stored);
    sendTelegram(`💳 Оплата заказа ${orderId} на ${stored.total || 0} ₽`);
    return c.json({
      success: true,
      orderId,
      paymentLink: `${SUPABASE_URL}/functions/v1/make-server-aa167a09/payment-success?orderId=${orderId}`,
    });
  } catch (err) {
    logErr("retail/checkout/pay", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/retail/check-pending-payments`, async (c) => {
  try {
    const orders = await kv.getByPrefix("retail:order:");
    const pending = orders.filter((o: any) => o.paymentStatus === "pending");
    return c.json({ checked: pending.length, updated: 0 });
  } catch (err) {
    logErr("check-pending-payments", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── EMAIL (Resend) ─────────────────────────────────────────────────────────
app.post(`${prefix}/email/send`, async (c) => {
  try {
    const { to, subject, html, from } = await c.req.json();
    const r = await sendEmail(to, subject, html, from);
    return c.json({ success: !!r, result: r });
  } catch (err) {
    logErr("email/send", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── UTILITIES ──────────────────────────────────────────────────────────────
app.post(`${prefix}/utilities/find-orders-by-total`, async (c) => {
  try {
    const { totals } = await c.req.json();
    const ws = await kv.getByPrefix("order:");
    const rt = await kv.getByPrefix("retail:order:");
    const matches = (arr: any[], prefix: string) =>
      arr
        .filter((o: any) => totals.includes(o.total))
        .map((o: any) => ({ ...o, _key: `${prefix}${o.orderId}` }));
    return c.json({
      wholesale: matches(ws, "order:"),
      retail: matches(rt, "retail:order:"),
      misplaced: [],
    });
  } catch (err) {
    logErr("find-orders-by-total", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/utilities/delete-order-by-key`, async (c) => {
  try {
    const { key } = await c.req.json();
    await kv.del(key);
    return c.json({ success: true, deletedKey: key });
  } catch (err) {
    logErr("delete-order-by-key", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/utilities/delete-orders-by-keys`, async (c) => {
  try {
    const { keys } = await c.req.json();
    const deleted: string[] = [];
    const failed: any[] = [];
    for (const k of keys || []) {
      try {
        await kv.del(k);
        deleted.push(k);
      } catch (e) {
        failed.push({ key: k, error: String(e) });
      }
    }
    return c.json({ deleted, failed });
  } catch (err) {
    logErr("delete-orders-by-keys", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/utilities/list-all-order-keys`, async (c) => {
  try {
    const ws = await kv.getByPrefix("order:");
    const rt = await kv.getByPrefix("retail:order:");
    return c.json({
      wholesale: ws.map((o: any) => ({ key: `order:${o.orderId}`, orderId: o.orderId })),
      retail: rt.map((o: any) => ({ key: `retail:order:${o.orderId}`, orderId: o.orderId })),
      problematic: [],
      summary: {
        wholesaleCount: ws.length,
        retailCount: rt.length,
        problematicCount: 0,
      },
    });
  } catch (err) {
    logErr("list-all-order-keys", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── AGENTS ─────────────────────────────────────────────────────────────────
app.get(`${prefix}/agents`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("agent:profile:"));
  } catch (err) {
    logErr("agents GET", err);
    return c.json([]);
  }
});
app.post(`${prefix}/agents`, async (c) => {
  try {
    const body = await c.req.json();
    const id = newId("agent-");
    const agent = {
      id,
      ...body,
      status: body.status || "active",
      created_at: new Date().toISOString(),
    };
    await kv.set(`agent:profile:${id}`, agent);
    return c.json(agent);
  } catch (err) {
    logErr("agents POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/agents/:id`, async (c) => {
  try {
    const a = await kv.get(`agent:profile:${c.req.param("id")}`);
    if (!a) return c.json({ error: "Not found" }, 404);
    return c.json(a);
  } catch (err) {
    logErr("agents GET id", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/agents/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const cur = (await kv.get(`agent:profile:${id}`)) || { id };
    const merged = { ...cur, ...updates, id };
    await kv.set(`agent:profile:${id}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("agents PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/agents/:id/stats`, async (c) => {
  try {
    const id = c.req.param("id");
    const agent = await kv.get(`agent:profile:${id}`);
    if (!agent) return c.json({ error: "Not found" }, 404);
    const clients = (await kv.getByPrefix(`agent:client:${id}:`)) || [];
    const payouts = (await kv.getByPrefix(`agent:payout:${id}:`)) || [];
    return c.json({ agent, clients, payouts, stats: { totalEarned: 0, totalPaid: 0 } });
  } catch (err) {
    logErr("agents/stats", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.get(`${prefix}/agents/:id/clients`, async (c) => {
  try {
    return c.json(await kv.getByPrefix(`agent:client:${c.req.param("id")}:`));
  } catch (err) {
    logErr("agents/clients GET", err);
    return c.json([]);
  }
});
app.post(`${prefix}/agents/:id/clients`, async (c) => {
  try {
    const agentId = c.req.param("id");
    const body = await c.req.json();
    const id = newId("client-");
    const client = { id, agent_id: agentId, ...body, created_at: new Date().toISOString() };
    await kv.set(`agent:client:${agentId}:${id}`, client);
    return c.json(client);
  } catch (err) {
    logErr("agents/clients POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/agents/:id/payouts`, async (c) => {
  try {
    const agentId = c.req.param("id");
    const body = await c.req.json();
    const id = newId("payout-");
    const p = {
      id,
      agent_id: agentId,
      ...body,
      status: body.status || "pending",
      created_at: new Date().toISOString(),
    };
    await kv.set(`agent:payout:${agentId}:${id}`, p);
    return c.json(p);
  } catch (err) {
    logErr("agents/payouts POST", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.put(`${prefix}/agents/payouts/:payoutId`, async (c) => {
  try {
    const payoutId = c.req.param("payoutId");
    const updates = await c.req.json();
    const all = await kv.getByPrefix("agent:payout:");
    const found = all.find((p: any) => p.id === payoutId);
    if (!found) return c.json({ error: "Not found" }, 404);
    const merged = { ...found, ...updates };
    await kv.set(`agent:payout:${found.agent_id}:${payoutId}`, merged);
    return c.json(merged);
  } catch (err) {
    logErr("agents/payouts PUT", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── BACKUP (stub) ──────────────────────────────────────────────────────────
app.post(`${prefix}/backup/check-schedule`, (c) =>
  c.json({ ok: true, ranAt: new Date().toISOString() }),
);

// ─── ADMIN RETAIL USERS ─────────────────────────────────────────────────────
app.get(`${prefix}/admin/retail-users`, async (c) => {
  try {
    return c.json(await kv.getByPrefix("retail:user:"));
  } catch (err) {
    logErr("admin/retail-users", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.delete(`${prefix}/admin/retail-users/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    try {
      await adminSupabase().auth.admin.deleteUser(id);
    } catch (_) {}
    await kv.del(`retail:user:${id}`);
    return c.json({ success: true });
  } catch (err) {
    logErr("admin/retail-users DELETE", err);
    return c.json({ error: "Failed" }, 500);
  }
});
app.post(`${prefix}/admin/retail-users/:id/balance`, async (c) => {
  try {
    const id = c.req.param("id");
    const { delta, points } = await c.req.json();
    const u = (await kv.get(`retail:user:${id}`)) || { id, points: 0 };
    u.points = (u.points || 0) + (Number(delta ?? points) || 0);
    await kv.set(`retail:user:${id}`, u);
    return c.json(u);
  } catch (err) {
    logErr("admin/retail-users/balance", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ─── SITEMAP / ROBOTS ───────────────────────────────────────────────────────
app.get(`${prefix}/sitemap.xml`, async (c) => {
  try {
    const products = await kv.getByPrefix("retail:product:");
    const base = "https://nechai.coffee";
    const urls = [
      `${base}/`,
      `${base}/shop`,
      `${base}/about`,
      `${base}/contacts`,
      `${base}/locations`,
      ...products.map((p: any) => `${base}/product/${p.id}`),
    ];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`)
        .join("\n") +
      `\n</urlset>`;
    return c.body(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
  } catch (err) {
    logErr("sitemap.xml", err);
    return c.body("<?xml version=\"1.0\"?><urlset/>", 500, {
      "Content-Type": "application/xml",
    });
  }
});
app.get(`${prefix}/robots.txt`, (c) => {
  const txt = `User-agent: *\nAllow: /\nSitemap: https://nechai.coffee/sitemap.xml\n`;
  return c.body(txt, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

// Restore from JSON backup (admin only)
app.post(`${prefix}/admin/restore-backup`, async (c) => {
  try {
    const body = await c.req.json();
    const stats: Record<string, number> = {};

    if (Array.isArray(body.coffeeItems)) {
      const pairs = body.coffeeItems.map((it: any) => ({ key: `coffee:item:${it.id}`, value: it }));
      if (pairs.length) await kv.mset(pairs);
      stats.coffeeItems = pairs.length;
    }
    if (Array.isArray(body.orders)) {
      const pairs = body.orders.map((o: any) => ({ key: `order:${o.id}`, value: o }));
      if (pairs.length) await kv.mset(pairs);
      stats.orders = pairs.length;
    }
    if (Array.isArray(body.users)) {
      const pairs = body.users.map((u: any) => ({ key: `user:${u.id || u.phone || u.inn}`, value: u }));
      if (pairs.length) await kv.mset(pairs);
      stats.users = pairs.length;
    }
    if (Array.isArray(body.promoCodes)) {
      const pairs = body.promoCodes.map((p: any) => ({ key: `promo:${p.code}`, value: p }));
      if (pairs.length) await kv.mset(pairs);
      stats.promoCodes = pairs.length;
    }
    if (body.exchangeRate && typeof body.exchangeRate === "object") {
      await kv.set("exchange_rate", body.exchangeRate);
      stats.exchangeRate = 1;
    }
    if (Array.isArray(body.userSettings)) {
      const pairs = body.userSettings
        .filter((u: any) => u.id || u.phone || u.inn)
        .map((u: any) => ({ key: `user:settings:${u.id || u.phone || u.inn}`, value: u }));
      if (pairs.length) await kv.mset(pairs);
      stats.userSettings = pairs.length;
    }

    return c.json({ ok: true, stats });
  } catch (err) {
    logErr("admin/restore-backup", err);
    return c.json({ error: String(err?.message || err) }, 500);
  }
});

// ─── 404 ────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));

app.onError((err, c) => {
  logErr("unhandled", err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

Deno.serve(app.fetch);
