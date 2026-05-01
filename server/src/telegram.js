/**
 * Telegram уведомления (Node API).
 * Переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (числовой id чата или @channelusername).
 */

import { ipv4HttpsRequest } from "./ipv4Https.js";

/** Разбор цепочки cause у TypeError fetch failed (Node / undici). */
export function serializeFetchError(e) {
  const parts = [];
  const codes = [];
  let cur = e;
  let depth = 0;
  while (cur != null && depth < 8) {
    if (typeof cur === "object") {
      if (cur.message) parts.push(String(cur.message));
      if (cur.code) codes.push(String(cur.code));
      if (cur.errno != null) parts.push(`errno=${cur.errno}`);
      if (cur.syscall) parts.push(`syscall=${cur.syscall}`);
      if (cur.hostname) parts.push(`host=${cur.hostname}`);
    } else {
      parts.push(String(cur));
    }
    cur = cur && typeof cur === "object" ? cur.cause : null;
    depth++;
  }
  const deduped = [...new Set(parts.filter(Boolean))];
  return {
    errorSummary: deduped.join(" | ") || String(e),
    codes: [...new Set(codes)],
  };
}

function escapeHtml(s) {
  if (s == null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramHtml(text) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    console.log("[telegram] пропуск: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID");
    return { ok: false, skipped: true, reason: "missing_env" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await ipv4HttpsRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4090),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[telegram] sendMessage HTTP", res.status, data);
      return { ok: false, httpStatus: res.status, data };
    }
    return { ok: true, data };
  } catch (e) {
    const detail = serializeFetchError(e);
    console.error("[telegram] sendMessage error", detail.errorSummary, detail.codes);
    return { ok: false, ...detail };
  }
}

export function formatWholesaleOrderMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsList = items
    .map((item) => {
      const type = item.type;
      let quantity = "";
      if (type === "coldbrew") {
        quantity = `${Number(item.kg) || 0} × 5 л`;
      } else {
        const kgText = item.kg > 0 ? `${item.kg} кг` : "";
        const packsText = item.packs200 > 0 ? `${item.packs200} × 200 г` : "";
        const sep = kgText && packsText ? ", " : "";
        quantity = `${kgText}${sep}${packsText}`;
      }
      const cat = item.category ? ` (${escapeHtml(item.category)})` : "";
      const sub = Number(item.subtotal) || 0;
      return `• ${escapeHtml(item.name)}${cat} — ${quantity} — ${sub.toLocaleString("ru-RU")} ₽`;
    })
    .join("\n");

  const totalKg = items.reduce((sum, item) => {
    if (item.type === "coldbrew") return sum;
    return sum + (Number(item.kg) || 0) + (Number(item.packs200) || 0) * 0.2;
  }, 0);

  const invoiceUrl = order.invoiceUrl || order.tochka_payment_url || order.paymentLink;
  const invoiceSection = invoiceUrl
    ? `\n\n💳 <b>Счёт:</b> <a href="${escapeHtml(invoiceUrl)}">ссылка</a>`
    : "";

  return `
🔔 <b>Новый оптовый заказ — Кофе Нечай</b>

📦 <b>Заказ:</b> <code>${escapeHtml(order.orderId)}</code>
📅 <b>Дата:</b> ${escapeHtml(new Date(order.date || Date.now()).toLocaleString("ru-RU"))}

🏢 <b>Компания:</b> ${escapeHtml(order.company || "—")}
ИНН: <code>${escapeHtml(order.inn || "—")}</code>
Р/с: <code>${escapeHtml(order.account || "—")}</code>
БИК: <code>${escapeHtml(order.bik || "—")}</code>
👤 <b>Контакт:</b> ${escapeHtml(order.contact || "—")}
📞 <b>Телефон:</b> <code>${escapeHtml(order.phone || "—")}</code>
📍 <b>Адрес:</b> ${escapeHtml(order.address || "—")}

🚚 <b>Доставка:</b> ${escapeHtml(order.delivery_company || "—")}
📦 <b>Способ:</b> ${escapeHtml(order.delivery_method || "—")}
📍 <b>Адрес доставки:</b> ${escapeHtml(order.delivery_address || "—")}

<b>Состав:</b>
${itemsList || "—"}

⚖️ <b>Вес:</b> ${totalKg.toFixed(2)} кг
💰 <b>Итого:</b> ${Number(order.total || 0).toLocaleString("ru-RU")} ₽${invoiceSection}
`.trim();
}

export function formatRetailOrderMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsList = items
    .map((item, index) => {
      const weightText = item.weight ? ` (${escapeHtml(item.weight)})` : "";
      const roastText = item.roast ? ` — ${escapeHtml(item.roast)}` : "";
      const grindText = item.grind ? ` — ${escapeHtml(item.grind)}` : "";
      const qty = Number(item.quantity) || 0;
      const sub = Number(item.subtotal) || 0;
      return `${index + 1}. ${escapeHtml(item.name || "—")}${weightText}${roastText}${grindText} × ${qty} шт. — ${sub.toLocaleString("ru-RU")} ₽`;
    })
    .join("\n");

  let deliveryText = "🏪 Самовывоз";
  if (order.delivery_method === "cdek") {
    deliveryText = `🚚 СДЭК: ${escapeHtml(order.delivery_address || "—")}`;
    if (order.delivery_cost > 0) deliveryText += `\n💰 Доставка: ${order.delivery_cost} ₽`;
    else deliveryText += `\n💰 Доставка: бесплатно`;
    if (order.cdek_number) deliveryText += `\n📦 Трек: <code>${escapeHtml(order.cdek_number)}</code>`;
  } else if (order.delivery_method === "delivery") {
    deliveryText = `🚚 Доставка: ${escapeHtml(order.delivery_address || "—")}`;
  }

  const inv = order.invoiceUrl || order.tochka_payment_url || order.paymentLink;
  const invLine = inv ? `\n🧾 <b>Счёт:</b> ${escapeHtml(inv)}` : "";

  return `
🛍 <b>Новый розничный заказ — Кофе Нечай</b>

📦 <b>Заказ:</b> <code>${escapeHtml(order.orderId)}</code>
📅 <b>Дата:</b> ${escapeHtml(new Date(order.date || Date.now()).toLocaleString("ru-RU"))}

👤 <b>Клиент:</b> ${escapeHtml(order.contact || "—")}
📞 <b>Телефон:</b> <code>${escapeHtml(order.phone || "—")}</code>
${order.email ? `📧 <b>Email:</b> ${escapeHtml(order.email)}\n` : ""}
${deliveryText}

<b>Состав:</b>
${itemsList || "—"}

${order.subtotal ? `💵 <b>Товары:</b> ${Number(order.subtotal).toLocaleString("ru-RU")} ₽\n` : ""}💰 <b>Итого:</b> ${Number(order.total || 0).toLocaleString("ru-RU")} ₽${invLine}
`.trim();
}

export function formatWholesaleAccessRequest(item) {
  return `
📩 <b>Заявка на доступ к опту — Кофе Нечай</b>

👤 <b>Имя:</b> ${escapeHtml(item.name || "—")}
🏢 <b>Компания:</b> ${escapeHtml(item.company || "—")}
📞 <b>Телефон:</b> <code>${escapeHtml(item.phone || "—")}</code>
📧 <b>Email:</b> ${escapeHtml(item.email || "—")}
💬 <b>Канал:</b> ${escapeHtml(item.channel || "—")}
`.trim();
}

export function formatBusinessRegistration(item) {
  return `
📝 <b>Регистрация бизнеса (прайс) — Кофе Нечай</b>

📞 <b>Телефон:</b> <code>${escapeHtml(item.phone || "—")}</code>
🏢 <b>Компания:</b> ${escapeHtml(item.companyName || "—")}
💬 <b>Мессенджер:</b> ${escapeHtml(item.messenger || "—")}
`.trim();
}

export function formatLocationRequest(item) {
  return `
📍 <b>Заявка: кофейня на карте — Кофе Нечай</b>

🏷 <b>Название:</b> ${escapeHtml(item.name || "—")}
🗺 <b>Адрес:</b> ${escapeHtml(item.address || "—")}
📌 <b>Координаты:</b> <code>${item.latitude ?? "—"}, ${item.longitude ?? "—"}</code>
👤 <b>Контакт:</b> ${escapeHtml(item.contactName || "—")}
📞 <b>Телефон:</b> <code>${escapeHtml(item.contactPhone || "—")}</code>
`.trim();
}

export function formatPaymentReceived(order) {
  return `
🎉 <b>Оплата получена — Кофе Нечай</b>

📦 <b>Заказ:</b> <code>${escapeHtml(order.orderId)}</code>
💰 <b>Сумма:</b> ${Number(order.total || 0).toLocaleString("ru-RU")} ₽
👤 <b>Клиент:</b> ${escapeHtml(order.contact || "—")}
📧 <b>Email:</b> ${escapeHtml(order.email || "—")}
📱 <b>Телефон:</b> <code>${escapeHtml(order.phone || "—")}</code>
`.trim();
}

export function notifyTelegram(html) {
  return sendTelegramHtml(html).catch((err) => console.error("[telegram] notify", err));
}
