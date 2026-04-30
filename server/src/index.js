import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { calculateDelivery, getPickupPoints, searchCities } from "./cdek.js";
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
} from "./store.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "1mb" }));

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

app.post("/api/orders", async (req, res) => {
  const body = req.body || {};
  const order = {
    orderId: body.orderId || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: body.date || new Date().toISOString(),
    orderType: "wholesale",
    ...body,
  };
  res.json(await addOrder(order));
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
  const body = req.body || {};
  const order = {
    orderId: body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: body.date || new Date().toISOString(),
    orderType: "retail",
    paymentStatus: body.paymentStatus || "pending",
    ...body,
  };
  res.json(await addRetailOrder(order));
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
  res.json({
    hasToken: Boolean(process.env.TOCHKA_JWT_TOKEN),
    hasCustomer: Boolean(process.env.TOCHKA_CUSTOMER_CODE),
    hasMerchant: Boolean(process.env.TOCHKA_MERCHANT_ID),
    hasTerminal: Boolean(process.env.TOCHKA_TERMINAL_ID),
    hasClientId: Boolean(process.env.TOCHKA_CLIENT_ID),
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

  try {
    const response = await fetch("https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Data: {
          customerCode,
          merchantId,
          terminalId,
          amount: String(finalAmount),
          purpose: purpose || `Заказ ${orderId}`,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to create Tochka invoice",
        details: data,
      });
    }

    const invoiceId = data?.Data?.operationId || data?.Data?.paymentLink || `INV-${orderId}`;
    const paymentLink = data?.Data?.paymentLink;
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

app.post("/api/tochka/webhook", async (req, res) => {
  // Important: always return 200 to avoid repeated retries.
  try {
    const payload = req.body || {};
    const requestId = payload.requestId || payload?.Data?.requestId || payload?.Data?.operationId || payload.operationId;
    const externalOrderId = payload.orderId || payload?.Data?.orderId || payload?.Data?.metadata?.orderId;
    const statusRaw = String(payload.status || payload?.Data?.status || payload.paymentStatus || "").toLowerCase();

    let statusMapped = "pending";
    if (["paid", "success", "completed", "authorized", "done"].includes(statusRaw)) statusMapped = "paid";
    if (["failed", "error", "declined"].includes(statusRaw)) statusMapped = "failed";
    if (["cancelled", "canceled"].includes(statusRaw)) statusMapped = "cancelled";

    let orderId = externalOrderId;
    if (!orderId && requestId && String(requestId).startsWith("PAY-")) {
      orderId = String(requestId).slice(4);
    }

    if (orderId) {
      const updates = {
        paymentStatus: statusMapped,
        payment_status: statusMapped,
        paidAt: statusMapped === "paid" ? new Date().toISOString() : undefined,
        tochkaWebhookAt: new Date().toISOString(),
        tochkaWebhookPayload: payload,
      };
      (await updateRetailOrderById(orderId, updates)) || (await updateOrderById(orderId, updates));
    }

    return res.status(200).send("OK");
  } catch (_error) {
    return res.status(200).send("OK");
  }
});

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

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "API route not found",
  });
});

initStorage()
  .then(() => {
    app.listen(port, () => {
      console.log(`[site-api] listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  });
