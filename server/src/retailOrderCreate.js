import { addRetailOrder, updateRetailOrderById, getRetailLoyalty, setRetailLoyalty, reserveNextRetailOrderNumber } from "./store.js";
import { createCdekOrder } from "./cdekOrderCreate.js";
import {
  buildPaymentsWithReceiptData,
  fetchPaymentsWithReceipt,
  extractPaymentLink,
  extractOperationId,
  tochkaClientPhone,
} from "./tochkaAcquiringReceipt.js";

/**
 * Платёжная ссылка + чек: полное тело payments_with_receipt (Client, Items, Supplier, taxSystemCode).
 * @returns {{ paymentLink?: string, invoiceId?: string, tochkaStatusRaw?: unknown, error?: string }}
 */
async function createTochkaAcquiringPayment(order) {
  const jwtToken = (process.env.TOCHKA_JWT_TOKEN || "").trim();
  const customerCode = (process.env.TOCHKA_CUSTOMER_CODE || "").trim();
  const merchantId = (process.env.TOCHKA_MERCHANT_ID || "").trim();
  const terminalId = (process.env.TOCHKA_TERMINAL_ID || "").trim();
  if (!jwtToken || !customerCode) {
    return { error: "Нет TOCHKA_JWT_TOKEN или TOCHKA_CUSTOMER_CODE в .env на API." };
  }
  if (!merchantId || !terminalId) {
    return {
      error:
        "Для эквайринга нужны TOCHKA_MERCHANT_ID и TOCHKA_TERMINAL_ID (идентификаторы терминала в личном кабинете Точки). Без terminalId ссылка на оплату не создаётся.",
    };
  }

  const phone = tochkaClientPhone(order.phone);
  if (!phone) {
    return {
      error:
        "Для чека Точки нужен корректный телефон покупателя (10–11 цифр, РФ). Проверьте поле телефона в заказе.",
    };
  }

  const dataPayload = buildPaymentsWithReceiptData(order, {});

  const { response, data } = await fetchPaymentsWithReceipt(dataPayload);
  if (!response.ok) {
    const snippet = JSON.stringify(data).slice(0, 800);
    console.error("[retail] Tochka acquiring error", response.status, snippet);
    return {
      error: `Точка HTTP ${response.status}: ${snippet || response.statusText}`,
      tochkaStatusRaw: data,
    };
  }
  const paymentLink = extractPaymentLink(data);
  const invoiceId = extractOperationId(data) || paymentLink;
  if (!paymentLink) {
    return {
      error: `Точка ответила 200, но без paymentLink. Ответ: ${JSON.stringify(data).slice(0, 700)}`,
      tochkaStatusRaw: data,
    };
  }
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

  const technicalOrderId =
    body.orderId || `RETAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let orderNumber;
  try {
    const reserved = await reserveNextRetailOrderNumber();
    orderNumber = reserved.number;
  } catch (e) {
    console.error("[retail] reserve order number failed", e?.message || e);
    orderNumber = undefined;
  }

  const order = {
    orderId: technicalOrderId,
    orderNumber,
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
      technicalOrderId,
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
  let tochkaPaymentError = null;
  let tochkaStatusRaw = null;
  try {
    const r = await createTochkaAcquiringPayment(order);
    tochkaStatusRaw = r?.tochkaStatusRaw ?? null;
    if (r?.paymentLink) {
      tochkaPaymentUrl = r.paymentLink;
      await updateRetailOrderById(technicalOrderId, {
        paymentLink: tochkaPaymentUrl,
        invoiceId: r.invoiceId,
        invoiceCreatedAt: new Date().toISOString(),
        tochkaStatusRaw: r.tochkaStatusRaw,
        tochka_payment_url: tochkaPaymentUrl,
        paymentStatus: "pending",
      });
    } else if (r?.error) {
      tochkaPaymentError = r.error;
      await updateRetailOrderById(technicalOrderId, {
        tochkaStatusRaw: r.tochkaStatusRaw,
        tochka_payment_error: r.error,
      }).catch(() => {});
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[retail] Tochka payment creation failed", msg);
    tochkaPaymentError = msg;
  }

  return {
    ...order,
    tochkaPaymentUrl,
    tochka_payment_url: tochkaPaymentUrl,
    tochkaPaymentError,
    tochka_payment_error: tochkaPaymentError,
    tochkaStatusRaw,
  };
}
