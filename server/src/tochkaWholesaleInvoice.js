/**
 * Счёт в Точка Банк для оптовых заказов (uapi/invoice/v1.0/bills), как в legacy Supabase.
 */

import { reserveNextWholesaleInvoiceNumber } from "./store.js";

const TOCHKA_BILLS_URL = "https://enter.tochka.com/uapi/invoice/v1.0/bills";

/** @param {any[]} items */
export function formatTochkaPositions(items) {
  const positions = [];

  for (const item of items || []) {
    const isDrip = item.type === "drip";
    const isColdBrew = item.type === "coldbrew";
    const categorySuffix = item.category ? ` (${item.category})` : "";

    if (isColdBrew) {
      if (item.kg > 0) {
        const pricePer5L = item.priceKg || item.subtotal / Math.max(item.kg, 1);
        positions.push({
          positionName: `${item.name} (5 л)`,
          unitCode: "шт.",
          ndsKind: "without_nds",
          price: String(Math.round(pricePer5L)),
          quantity: String(item.kg),
          totalAmount: String(item.subtotal),
          totalNds: "0",
        });
      }
      continue;
    }

    const kg = Number(item.kg) || 0;
    const packs200 = Number(item.packs200) || 0;
    const itemSubtotal = Number(item.subtotal) || 0;
    const hasBoth = kg > 0 && packs200 > 0;

    if (kg > 0) {
      const priceKg = Number(item.priceKg) || itemSubtotal / kg;
      // Когда есть и упаковки, и штуки — берём остаток чтобы сумма позиций точно совпадала с item.subtotal
      const kgSubtotal = hasBoth ? Math.round(kg * priceKg) : itemSubtotal;
      positions.push({
        positionName: isDrip ? `${item.name} (упак. 10 шт.)` : `${item.name}${categorySuffix}`,
        unitCode: isDrip ? "шт." : "кг.",
        ndsKind: "without_nds",
        price: String(Math.round(priceKg)),
        quantity: String(kg),
        totalAmount: String(kgSubtotal),
        totalNds: "0",
      });
    }

    if (packs200 > 0) {
      const price200 = Number(item.price200) || itemSubtotal / packs200;
      // Используем остаток от item.subtotal для точного совпадения суммы
      const kgSubtotal = hasBoth ? Math.round((Number(item.priceKg) || itemSubtotal / kg) * kg) : 0;
      const packs200Subtotal = hasBoth ? itemSubtotal - kgSubtotal : itemSubtotal;
      positions.push({
        positionName: isDrip ? `${item.name} (1 шт.)` : `${item.name}${categorySuffix} (упак. 200г)`,
        unitCode: "шт.",
        ndsKind: "without_nds",
        price: String(Math.round(price200)),
        quantity: String(packs200),
        totalAmount: String(packs200Subtotal),
        totalNds: "0",
      });
    }
  }

  return positions;
}

/**
 * Создаёт счёт в Точка; при ошибке возвращает null (заказ уже сохранён).
 * @param {Record<string, any>} order
 * @returns {Promise<{ invoiceId: string, invoiceUrl: string, invoiceNumber: string } | null>}
 */
export async function createWholesaleTochkaBill(order) {
  const jwtToken = process.env.TOCHKA_JWT_TOKEN;
  if (!jwtToken) {
    console.log("[tochka wholesale] пропуск счёта: нет TOCHKA_JWT_TOKEN");
    return null;
  }

  const accountId =
    process.env.TOCHKA_INVOICE_ACCOUNT_ID || "40802810901500399057/044525104";
  const customerCode = process.env.TOCHKA_CUSTOMER_CODE || "303213604";

  const inn = String(order.inn || "").trim();
  if (!order.company || !inn || !order.items?.length) {
    console.log("[tochka wholesale] пропуск: нет company/inn/items");
    return null;
  }

  const positions = formatTochkaPositions(order.items);
  if (!positions.length) {
    console.log("[tochka wholesale] пропуск: пустые позиции");
    return null;
  }

  const secondSide = {
    taxCode: inn,
    type: inn.length === 10 ? "company" : "ip",
    secondSideName: order.company,
    legalAddress: order.address,
    ...(inn.length === 10 && order.kpp ? { kpp: order.kpp } : {}),
    ...(order.account && order.bik ? { accountId: `${order.account}/${order.bik}` } : {}),
  };

  const today = new Date().toISOString().split("T")[0];
  const paymentExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Резервируем следующий порядковый номер счёта (например "1-1", "1-2", ...)
  let invoiceNumber;
  try {
    const reserved = await reserveNextWholesaleInvoiceNumber();
    invoiceNumber = reserved.number;
  } catch (e) {
    console.error("[tochka wholesale] reserve invoice number failed", e?.message || e);
    // Фолбэк: если счётчик недоступен, используем orderId — счёт всё равно создадим
    invoiceNumber = order.orderId;
  }

  const invoiceBody = {
    Data: {
      accountId,
      customerCode,
      SecondSide: secondSide,
      Content: {
        Invoice: {
          Positions: positions,
          date: today,
          totalAmount: String(order.total ?? ""),
          totalNds: "0",
          number: invoiceNumber,
          basedOn: `Заказ ${order.orderId} с сайта coffeenechai.ru`,
          comment: `Доставка: ${order.delivery_company || "—"} — ${order.delivery_method || "—"}. Контакт: ${order.contact || "—"}, ${order.phone || "—"}`,
          paymentExpiryDate: paymentExpiry,
        },
      },
    },
  };

  try {
    const invoiceResponse = await fetch(TOCHKA_BILLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(invoiceBody),
    });

    if (!invoiceResponse.ok) {
      const errText = await invoiceResponse.text().catch(() => "");
      console.error("[tochka wholesale] bills HTTP", invoiceResponse.status, errText.slice(0, 500));
      return null;
    }

    const invoiceData = await invoiceResponse.json();
    const d = invoiceData.Data || invoiceData;
    const invoiceId = d.id || d.bill_id || invoiceData.id || invoiceData.bill_id || order.orderId;
    const invoiceUrl = `https://enter.tochka.com/invoice/${invoiceId}`;
    return { invoiceId, invoiceUrl, invoiceNumber };
  } catch (e) {
    console.error("[tochka wholesale] bills error", e?.message || e);
    return null;
  }
}
