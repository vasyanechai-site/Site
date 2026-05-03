/**
 * Создание заказа в СДЭК (розница). Логика согласована с src/app/supabase/functions/server/cdek_order_create.tsx
 */
import { getCdekToken, getCdekApiBase } from "./cdek.js";
const COMPANY_NAME = "ИП Порохина Анастасия Игоревна";
const CONTACT_PERSON = "Василий Нечай";
const COMPANY_EMAIL = "chai.nechai@yandex.ru";
const COMPANY_PHONE = "+79818747388";
const SENDER_OFFICE_CODE = "SPB1204";
const PACKAGE_COMMENT = "Хрупкое";

function normalizePhone(customerPhone) {
  let digits = String(customerPhone || "").replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  return `+${digits}`;
}

/**
 * @param {string} orderId
 * @param {string} customerName
 * @param {string} customerPhone
 * @param {{ pvzCode: string; tariffCode?: number }} deliveryInfo
 * @param {Array<{ id?: string; name: string; price: number; quantity: number; weight?: number; length?: number; width?: number; height?: number }>} items
 */
export async function createCdekOrder(orderId, customerName, customerPhone, deliveryInfo, items) {
  const apiBase = getCdekApiBase();
  const diagnostic = { api_host: apiBase, timestamp: new Date().toISOString() };

  try {
    if (!deliveryInfo?.pvzCode) {
      return { success: false, cdek_status: "error", cdek_error: "Missing PVZ code", diagnostic };
    }
    if (!customerName || !customerPhone) {
      return { success: false, cdek_status: "error", cdek_error: "Missing customer", diagnostic };
    }
    if (!items?.length) {
      return { success: false, cdek_status: "error", cdek_error: "No items", diagnostic };
    }

    const token = await getCdekToken();
    const normalizedPhone = normalizePhone(customerPhone);

    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    for (const item of items) {
      const quantity = item.quantity || 1;
      const weight = Math.max(Number(item.weight) || 200, 100);
      const length = Math.max(Number(item.length) || 10, 5);
      const width = Math.max(Number(item.width) || 8, 5);
      const height = Math.max(Number(item.height) || 5, 3);
      totalWeight += weight * quantity;
      maxLength = Math.max(maxLength, length);
      maxWidth = Math.max(maxWidth, width);
      maxHeight = Math.max(maxHeight, height);
    }

    const tariff = Number(deliveryInfo.tariffCode) || 136;
    if (totalWeight < 1000 && tariff === 136) totalWeight = 1000;

    const dimensions = [maxLength, maxWidth, maxHeight].sort((a, b) => b - a);
    const lengthCm = Math.round(dimensions[0]);
    const widthCm = Math.round(dimensions[1]);
    const heightCm = Math.round(dimensions[2]);

    const cdekOrder = {
      type: 1,
      number: orderId,
      tariff_code: tariff,
      comment: PACKAGE_COMMENT,
      shipment_point: SENDER_OFFICE_CODE,
      delivery_point: deliveryInfo.pvzCode,
      sender: {
        company: COMPANY_NAME,
        name: CONTACT_PERSON,
        email: COMPANY_EMAIL,
        phones: [{ number: COMPANY_PHONE }],
      },
      recipient: {
        name: customerName,
        phones: [{ number: normalizedPhone }],
      },
      packages: [
        {
          number: "1",
          comment: PACKAGE_COMMENT,
          weight: totalWeight,
          length: lengthCm,
          width: widthCm,
          height: heightCm,
          items: items.map((item, index) => ({
            name: item.name || "Товар",
            ware_key: item.id || `item_${index}`,
            payment: { value: 0 },
            cost: item.price || 0,
            weight: Math.max(Number(item.weight) || 100, 50),
            amount: item.quantity || 1,
          })),
        },
      ],
    };

    diagnostic.order_body = cdekOrder;

    const cdekResponse = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cdekOrder),
    });

    const rawText = await cdekResponse.text();
    let cdekData;
    try {
      cdekData = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        cdek_status: "error",
        cdek_error: "Invalid JSON from CDEK",
        diagnostic: { ...diagnostic, raw_response: rawText },
      };
    }

    const hasErrors = cdekData.errors && Array.isArray(cdekData.errors) && cdekData.errors.length > 0;
    const hasEntity = cdekData.entity && cdekData.entity.uuid;

    if (!cdekResponse.ok || hasErrors || !hasEntity) {
      return {
        success: false,
        cdek_status: "failed",
        cdek_error: cdekData.errors || cdekData.message || rawText,
        cdek_data: cdekData,
        diagnostic: { ...diagnostic, response_status: cdekResponse.status },
      };
    }

    const uuid = cdekData.entity.uuid;
    const cdek_number = cdekData.entity.cdek_number || orderId;
    return {
      success: true,
      cdek_uuid: uuid,
      cdek_number,
      cdek_status: "created",
      cdek_data: cdekData,
      diagnostic,
    };
  } catch (error) {
    return {
      success: false,
      cdek_status: "error",
      cdek_error: error instanceof Error ? error.message : String(error),
      diagnostic,
    };
  }
}
