/**
 * Telegram уведомления (Node API).
 * Переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (числовой id чата или @channelusername).
 * Обход блокировки api.telegram.org: TELEGRAM_RELAY_URL + TELEGRAM_RELAY_SECRET → Supabase Edge `telegram-relay`.
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

/** Исходящий HTTPS к relay (Supabase Edge и т.п.); на заблокированном VPS до api.telegram.org не ходим. */
async function sendTelegramViaRelay({ text, reply_markup }) {
  const relayUrl = (process.env.TELEGRAM_RELAY_URL || "").trim();
  const relaySecret = (process.env.TELEGRAM_RELAY_SECRET || "").trim();
  if (!relayUrl || !relaySecret) {
    return { ok: false, skipped: true, reason: "relay_misconfigured" };
  }
  try {
    const body = { text: String(text).slice(0, 4090) };
    if (reply_markup && typeof reply_markup === "object") {
      body.reply_markup = reply_markup;
    }
    const res = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${relaySecret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[telegram] relay HTTP", res.status, data);
      return { ok: false, httpStatus: res.status, data };
    }
    if (!data.ok) {
      console.error("[telegram] relay ответ", data);
      return { ok: false, data };
    }
    return { ok: true, data: data.result };
  } catch (e) {
    const detail = serializeFetchError(e);
    console.error("[telegram] relay error", detail.errorSummary, detail.codes);
    return { ok: false, ...detail };
  }
}

export async function sendTelegramHtml(text, reply_markup) {
  const relayUrl = (process.env.TELEGRAM_RELAY_URL || "").trim();
  if (relayUrl) {
    return sendTelegramViaRelay({ text, reply_markup });
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    console.log("[telegram] пропуск: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID");
    return { ok: false, skipped: true, reason: "missing_env" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const payload = {
      chat_id: chatId,
      text: String(text).slice(0, 4090),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (reply_markup && typeof reply_markup === "object") {
      payload.reply_markup = reply_markup;
    }
    const res = await ipv4HttpsRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

/** Отправка в Telegram + лог при сбое (relay или TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). */
export async function telegramNotify(context, html, reply_markup) {
  const r = await sendTelegramHtml(html, reply_markup);
  if (!r.ok) {
    console.error(`[telegram] ${context}`, JSON.stringify(r).slice(0, 800));
  }
  return r;
}

/** Кнопки «копировать» логин/пароль (Bot API: InlineKeyboardButton.copy_text). */
export function buildWholesaleAccessCopyKeyboard(loginPhone, password) {
  return {
    inline_keyboard: [
      [
        { text: "📋 Логин", copy_text: { text: String(loginPhone) } },
        { text: "📋 Пароль", copy_text: { text: String(password) } },
      ],
    ],
  };
}

/**
 * Текст для пересылки клиенту (опт, вход по телефону).
 * @param {string} loginPhone — 89999999999
 * @param {string} password
 * @param {{ display: string, url: string } | null} [telegramMeta] — ссылка на t.me
 */
export function formatWholesaleBusinessLoginForwardMessage(loginPhone, password, telegramMeta = null) {
  const l = escapeHtml(loginPhone);
  const p = escapeHtml(password);
  const lines = [
    "Привет! Это ваши доступы к сайту Нечай кофе — coffeenechai.ru.",
    "",
    "Для входа нажмите на кнопку «Вход для бизнеса» в шапке сайта и введите логин и пароль.",
    "",
    "Логин:",
    `<code>${l}</code>`,
    "",
    "Пароль:",
    `<code>${p}</code>`,
  ];
  if (telegramMeta?.url && telegramMeta?.display) {
    lines.push(
      "",
      `✈️ Телеграм: <a href="${escapeHtml(telegramMeta.url)}">${escapeHtml(telegramMeta.display)}</a>`,
    );
  }
  return lines.join("\n");
}

export function formatWholesaleOrderMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsList = items
    .map((item) => {
      const type = item.type;
      let quantity = "";
      if (type === "coldbrew") {
        quantity = `${Number(item.kg) || 0} × 5 л`;
      } else if (type === "drip") {
        // Для дрипов: kg = упаковки (10 шт), packs200 = одиночные штуки
        const packText = item.kg > 0 ? `${item.kg} упак. (10 шт.)` : "";
        const unitsText = item.packs200 > 0 ? `${item.packs200} шт.` : "";
        const sep = packText && unitsText ? ", " : "";
        quantity = `${packText}${sep}${unitsText}`;
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
    if (item.type === "drip") {
      // Упаковка 10 шт × 12 г = 120 г, одиночный дрип — 12 г
      return sum + (Number(item.kg) || 0) * 0.12 + (Number(item.packs200) || 0) * 0.012;
    }
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

/**
 * @param {Record<string, any>} item — заявка (поля формы)
 * @param {{ loginPhone: string, password: string } | null} creds — если аккаунт создан автоматически
 */
export function formatWholesaleAccessRequest(item, creds = null) {
  const ch = String(item.channel || "").toLowerCase();
  const un = String(item.telegramUsername || "").trim().toLowerCase();
  const telegramProfileLine =
    ch === "telegram" && un && /^[a-z][a-z0-9_]{4,31}$/.test(un)
      ? `\n✈️ <b>Ник в Telegram:</b> <a href="${escapeHtml(`https://t.me/${un}`)}">@${escapeHtml(un)}</a>`
      : "";

  const base = `
📩 <b>Заявка на доступ к опту — Кофе Нечай</b>

👤 <b>Имя:</b> ${escapeHtml(item.name || "—")}
🏢 <b>Компания:</b> ${escapeHtml(item.company || "—")}
📞 <b>Телефон:</b> <code>${escapeHtml(item.phone || "—")}</code>
📧 <b>Email:</b> ${escapeHtml(item.email || "—")}
💬 <b>Канал:</b> ${escapeHtml(item.channel || "—")}${telegramProfileLine}
`.trim();

  if (!creds || !creds.loginPhone || !creds.password) return base;

  const lp = escapeHtml(creds.loginPhone);
  const pw = escapeHtml(creds.password);
  return (
    `${base}

✅ <b>Аккаунт опта создан автоматически</b>
📱 <b>Логин</b> (нажмите на код, чтобы скопировать): <code>${lp}</code>
🔑 <b>Пароль</b>: <code>${pw}</code>`
  ).trim();
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

/**
 * Новый аккаунт розницы: логин = email, пароль в теге code — в Telegram по нажатию копируется.
 * @param {Record<string, any>} user — с полями email, password?, role, bonusPoints?, createdAt
 * @param {Record<string, any>} loyalty — из getRetailLoyalty: balance и т.д.
 */
export function formatNewRetailUserCreated(user, loyalty) {
  const email = String(user.email || "").trim() || "—";
  const pwd = user.password != null && String(user.password) !== "" ? String(user.password) : null;
  const createdRaw = user.createdAt || user.created_at || new Date().toISOString();
  const created = escapeHtml(new Date(createdRaw).toLocaleString("ru-RU"));
  const role = String(user.role || "user").trim();
  const bonus = Number(user.bonusPoints || 0);
  const balance = loyalty ? Number(loyalty.balance || 0) : 0;
  const loyaltyBits = [];
  if (Number.isFinite(bonus) && bonus !== 0) loyaltyBits.push(`бонус при регистрации: <b>${bonus}</b> баллов`);
  if (Number.isFinite(balance) && balance !== 0) loyaltyBits.push(`баланс лояльности: <b>${balance}</b>`);
  const loyaltyLine =
    loyaltyBits.length > 0 ? `\n🎁 <b>Лояльность:</b> ${loyaltyBits.join("; ")}` : "";

  const pwdBlock = pwd
    ? `\n🔑 <b>Пароль</b> (нажмите, чтобы скопировать):\n<code>${escapeHtml(pwd)}</code>`
    : `\n🔑 <b>Пароль:</b> не задан в запросе — задайте вручную или через восстановление.`;

  return `
🛒 <b>Новый пользователь розницы — Кофе Нечай</b>

📧 <b>Логин (email)</b> — нажмите, чтобы скопировать:
<code>${escapeHtml(email)}</code>${pwdBlock}

👤 <b>Роль:</b> ${escapeHtml(role)}
📅 <b>Создан:</b> ${created}${loyaltyLine}
`.trim();
}

/**
 * Новый пользователь опта: вход по телефону + пароль в теге code.
 * @param {Record<string, any>} user
 */
export function formatNewWholesaleUserCreated(user) {
  const phone = String(user.phone || "").trim() || "—";
  const pwd = user.password != null && String(user.password) !== "" ? String(user.password) : null;
  const createdRaw = user.created_at || user.createdAt || new Date().toISOString();
  const created = escapeHtml(new Date(createdRaw).toLocaleString("ru-RU"));
  const company = String(user.company_name || "").trim();
  const name = String(user.name || "").trim();
  const level = Number(user.loyaltyLevel ?? 0);
  const discount = Number(user.discount ?? 0);
  const hasLoyalty = (Number.isFinite(level) && level > 0) || (Number.isFinite(discount) && discount > 0);
  const loyaltyLine = hasLoyalty
    ? `\n🎁 <b>Лояльность:</b> уровень <b>${level}</b>, персональная скидка <b>${discount}</b>%`
    : "";

  const pwdBlock = pwd
    ? `\n🔑 <b>Пароль</b> (нажмите, чтобы скопировать):\n<code>${escapeHtml(pwd)}</code>`
    : `\n🔑 <b>Пароль:</b> не задан в запросе.`;

  return `
📦 <b>Новый пользователь опта — Кофе Нечай</b>

📱 <b>Логин (телефон)</b> — нажмите, чтобы скопировать:
<code>${escapeHtml(phone)}</code>${pwdBlock}
${company ? `\n🏢 <b>Компания:</b> ${escapeHtml(company)}` : ""}
${name ? `\n👤 <b>Имя:</b> ${escapeHtml(name)}` : ""}
${user.email ? `\n📧 <b>Email:</b> <code>${escapeHtml(String(user.email).trim())}</code>` : ""}
👤 <b>Роль:</b> ${escapeHtml(String(user.role || "wholesale"))}
📅 <b>Создан:</b> ${created}${loyaltyLine}
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
