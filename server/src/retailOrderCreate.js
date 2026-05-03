import { addRetailOrder, updateRetailOrderById, getRetailLoyalty, setRetailLoyalty } from "./store.js";
import { createCdekOrder } from "./cdekOrderCreate.js";

async function createTochkaAcquiringPayment(order) {
  const jwtToken = process.env.TOCHKA_JWT_TOKEN;
  const customerCode = process.env.TOCHKA_CUSTOMER_CODE;
  const merchantId = process.env.TOCHKA_MERCHANT_ID;
  const terminalId = process.env.TOCHKA_TERMINAL_ID;
  if (!jwtToken || !customerCode) return null;

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
        amount: String(Number(order.total) || 0),
        purpose: `Оплата заказа ${order.orderId}`,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[retail] Tochka acquiring error", response.status, JSON.stringify(data).slice(0, 500));
    return null;
  }
  const paymentLink = data?.Data?.paymentLink;
  const invoiceId = data?.Data?.operationId || data?.Data?.paymentLink;
  return { paymentLink, invoiceId, tochkaStatusRaw: data };
}

/**
 * Полный сценарий розничного заказа: расчёт суммы, СДЭК, сохранение, ссылка Точка.
 * @param {Record<string, any>} body — тело как от RetailStorefront
 */
export async function createRetailOrderFromCheckout(body) {
  const {
    customerName,
    customerPhone,
    customerEmail,
    userId,
    items,
    deliveryInfo,
    usedPoints,
  } = body || {};

  if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  const formattedItems = items.map((item) => ({
    id: item.product.id,
    name: item.product.name,
    category: item.product.category,
    price: item.product.price,
    quantity: item.quantity,
    weight: item.weight,
    roast: item.roast,
    grind: item.grind,
    subtotal: item.product.price * item.quantity,
    imageUrl: item.product.imageUrl,
  }));

  const subtotal = formattedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const deliveryMethod = deliveryInfo ? "cdek" : "pickup";
  const deliveryAddress = deliveryInfo ? `${deliveryInfo.city}, ${deliveryInfo.pvzAddress}` : "";

  let deliveryCost = Number(deliveryInfo?.cost) || 0;
  let total = subtotal + deliveryCost;
  let pointsUsed = 0;
  let pointsEarned = 0;

  if (userId) {
    const current = await getRetailLoyalty(userId);
    const currentBalance = Number(current.balance || 0);

    if (usedPoints && Number(usedPoints) > 0) {
      const requestedPoints = Math.min(Number(usedPoints), currentBalance);
      const maxDiscount = Math.max(0, total - 1);
      pointsUsed = Math.min(requestedPoints, maxDiscount);
      total -= pointsUsed;
      const newBalance = Math.max(0, currentBalance - pointsUsed);
      await setRetailLoyalty(userId, {
        ...current,
        balance: newBalance,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      pointsEarned = Math.floor(subtotal * 0.05);
    }
  }

  const orderId = body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const order = {
    orderId,
    date: new Date().toISOString(),
    orderType: "retail",
    contact: customerName,
    phone: customerPhone,
    email: customerEmail || "",
    userId: userId || undefined,
    delivery_address: deliveryAddress,
    delivery_method: deliveryMethod,
    delivery_cost: deliveryCost,
    delivery_info: deliveryInfo || null,
    items: formattedItems,
    total,
    subtotal,
    status: "pending",
    paymentStatus: "pending",
    pointsUsed,
    pointsEarned,
  };

  if (deliveryInfo?.pvzCode) {
    const cdekItems = formattedItems.map((item) => {
      const product = items.find((i) => i.product.id === item.id)?.product;
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        weight: product?.packageWeight || 200,
        length: product?.packageLength || 15,
        width: product?.packageWidth || 10,
        height: product?.packageHeight || 8,
      };
    });

    const cdekResult = await createCdekOrder(
      orderId,
      customerName,
      customerPhone,
      deliveryInfo,
      cdekItems,
    );

    order.cdek_uuid = cdekResult.cdek_uuid;
    order.cdek_number = cdekResult.cdek_number;
    order.cdek_status = cdekResult.cdek_status;
    order.cdek_data = cdekResult.cdek_data;
    order.cdek_error = cdekResult.cdek_error;
    order.cdek_diagnostic = cdekResult.diagnostic;
  }

  await addRetailOrder(order);

  let tochkaPaymentUrl = null;
  try {
    const r = await createTochkaAcquiringPayment(order);
    if (r?.paymentLink) {
      tochkaPaymentUrl = r.paymentLink;
      await updateRetailOrderById(orderId, {
        paymentLink: tochkaPaymentUrl,
        invoiceId: r.invoiceId,
        invoiceCreatedAt: new Date().toISOString(),
        tochkaStatusRaw: r.tochkaStatusRaw,
        tochka_payment_url: tochkaPaymentUrl,
        paymentStatus: "pending",
      });
    }
  } catch (e) {
    console.error("[retail] Tochka payment creation failed", e?.message || e);
  }

  return {
    ...order,
    tochkaPaymentUrl,
    tochka_payment_url: tochkaPaymentUrl,
  };
}
