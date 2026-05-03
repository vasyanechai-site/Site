/**
 * Тело запроса payments_with_receipt (платёжная ссылка + чек «Точка Чеки»).
 * @see https://developers.tochka.com/docs/tochka-api/opisanie-metodov/platyozhnye-ssylki
 */

/** @param {string | undefined} raw */
export function tochkaClientPhone(raw) {
  const clean = String(raw || "").replace(/\D/g, "");
  if (clean.length < 10) return null;
  let p = clean;
  if (p.startsWith("8") && p.length === 11) p = "7" + p.slice(1);
  else if (!p.startsWith("7") && p.length === 10) p = "7" + p;
  if (p.length !== 11 || !p.startsWith("7")) return null;
  return p;
}

/**
 * @param {Record<string, any>} order — поля: items[], total, delivery_cost?, phone, email, contact|customerName, orderId
 */
export function buildReceiptItemsFromRetailOrder(order) {
  /** @type {Array<{ name: string; amount: string; quantity: number; vatType: string; paymentMethod: string; paymentObject: string; measure: string }>} */
  const items = [];
  const list = Array.isArray(order.items) ? order.items : [];
  for (const it of list) {
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const sub = Number(it.subtotal != null ? it.subtotal : (Number(it.price) || 0) * qty) || 0;
    const unit = sub / qty;
    items.push({
      name: String(it.name || "Товар").slice(0, 255),
      amount: unit.toFixed(2),
      quantity: qty,
      vatType: "none",
      paymentMethod: "full_payment",
      paymentObject: "goods",
      measure: "шт.",
    });
  }
  const delivery = Number(order.delivery_cost ?? order.deliveryCost ?? 0) || 0;
  if (delivery > 0) {
    items.push({
      name: "Доставка СДЭК",
      amount: delivery.toFixed(2),
      quantity: 1,
      vatType: "none",
      paymentMethod: "full_payment",
      paymentObject: "service",
      measure: "шт.",
    });
  }
  return items;
}

/**
 * Подгонка суммы позиций к order.total (копейки/округление).
 * @param {ReturnType<typeof buildReceiptItemsFromRetailOrder>} items
 */
export function alignReceiptItemsTotal(items, orderTotal) {
  const total = Number(orderTotal) || 0;
  const sum = items.reduce((s, x) => s + parseFloat(x.amount) * x.quantity, 0);
  const diff = total - sum;
  if (items.length && Math.abs(diff) > 0.009) {
    const last = items[items.length - 1];
    const q = Math.max(1, Number(last.quantity) || 1);
    const newUnit = (parseFloat(last.amount) * q + diff) / q;
    last.amount = Math.max(0.01, newUnit).toFixed(2);
  }
  return items;
}

/**
 * Объект Data для POST …/payments_with_receipt.
 * @param {Record<string, any>} order
 * @param {{ purpose?: string; orderId?: string }} [overrides]
 */
export function buildPaymentsWithReceiptData(order, overrides = {}) {
  const customerCode = (process.env.TOCHKA_CUSTOMER_CODE || "").trim();
  const merchantId = (process.env.TOCHKA_MERCHANT_ID || "").trim();
  const terminalId = (process.env.TOCHKA_TERMINAL_ID || "").trim();
  const oid = String(overrides.orderId || order.orderId || order.order_id || "").trim();
  const taxSystemCode = (process.env.TOCHKA_RECEIPT_TAX_SYSTEM_CODE || "usn_income_outcome").trim();
  const supplierInn = (process.env.TOCHKA_RECEIPT_SUPPLIER_INN || "591000733530").trim();
  const supplierName = (
    process.env.TOCHKA_RECEIPT_SUPPLIER_NAME ||
    "Индивидуальный предприниматель Порохина Анастасия Игоревна"
  ).trim();
  const supplierPhoneRaw = process.env.TOCHKA_RECEIPT_SUPPLIER_PHONE || "+79818747388";
  const supplierDigits = tochkaClientPhone(supplierPhoneRaw) || "79818747388";
  const supplierPhone = supplierDigits.startsWith("7") ? `+${supplierDigits}` : supplierDigits;

  const baseUrl = (process.env.FRONTEND_BASE_URL || "https://coffeenechai.ru").replace(/\/+$/, "");

  let items = buildReceiptItemsFromRetailOrder(order);
  items = alignReceiptItemsTotal(items, order.total);
  const amountStr = Number(order.total || 0).toFixed(2);

  const phone = tochkaClientPhone(order.phone);
  const purpose = overrides.purpose || `Оплата заказа ${oid || "order"}`;

  /** @type {Record<string, any>} */
  const Data = {
    customerCode,
    merchantId,
    terminalId,
    amount: amountStr,
    purpose,
    paymentMode: ["card", "sbp"],
    taxSystemCode,
    Client: {
      name: String(order.contact || order.customerName || "Покупатель").slice(0, 255),
      email: String(order.email || "no-reply@coffeenechai.ru").trim() || "no-reply@coffeenechai.ru",
      phone: phone || "",
    },
    Items: items,
    Supplier: {
      name: supplierName,
      phone: supplierPhone,
      taxCode: supplierInn,
    },
    redirectUrl: `${baseUrl}/payment/success?orderId=${encodeURIComponent(oid || "order")}`,
    failRedirectUrl: `${baseUrl}/payment/fail?orderId=${encodeURIComponent(oid || "order")}`,
  };
  if (oid) Data.paymentLinkId = oid;
  return Data;
}

/**
 * @param {Record<string, any>} dataPayload — поле Data
 */
export async function fetchPaymentsWithReceipt(dataPayload) {
  const jwtToken = (process.env.TOCHKA_JWT_TOKEN || "").trim();
  const response = await fetch("https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Data: dataPayload }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export function extractPaymentLink(data) {
  return data?.Data?.paymentLink || data?.paymentLink || null;
}

export function extractOperationId(data) {
  return data?.Data?.operationId || data?.Data?.uuid || data?.operationId || null;
}
