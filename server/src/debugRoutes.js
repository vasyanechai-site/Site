/**
 * Диагностические маршруты (/api/debug/*). POST-тесты Telegram без секрета — ограничьте доступ к API (сеть / файрвол), если нужно.
 */

import { resolve4 } from "node:dns/promises";
import {
  sendTelegramHtml,
  formatWholesaleOrderMessage,
  formatRetailOrderMessage,
  telegramNotify,
  serializeFetchError,
} from "./telegram.js";
import { ipv4HttpsRequest } from "./ipv4Https.js";
import { getCdekToken, getCdekApiBase } from "./cdek.js";
import { createCdekOrder } from "./cdekOrderCreate.js";
import { createRetailOrderFromCheckout } from "./retailOrderCreate.js";

function chatIdHint(chatId) {
  const s = String(chatId || "").trim();
  if (!s) return "chat_id пустой";
  if (s.startsWith("-100")) return "похоже на канал / супергруппу (часто то, что нужно для общей ленты заявок)";
  if (s.startsWith("-")) return "отрицательный id (группа или старый формат)";
  if (/^\d+$/.test(s) && s.length < 12) return "похоже на личный user id — в канал так не доставится; нужен id канала вида -100…";
  return "проверьте, что бот админ канала с правом публиковать";
}

function maskMiddle(s, keep = 4) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  if (t.length <= keep * 2) return "•".repeat(Math.min(t.length, 8));
  return `${t.slice(0, keep)}…${t.slice(-keep)}`;
}

/** Из ответа Get Retailers вытаскиваем объекты с парой merchantId + terminalId (разные вложения Data). */
function summarizeTochkaRetailersResponse(data) {
  const seen = new Set();
  const rows = [];

  function visit(node, depth) {
    if (depth > 14 || node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    const mid = node.merchantId ?? node.MerchantId;
    const tid = node.terminalId ?? node.TerminalId;
    if (mid && tid) {
      const key = `${String(mid)}|${String(tid)}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          name: String(node.name ?? node.Name ?? ""),
          merchantId: String(mid),
          terminalId: String(tid),
          status: String(node.status ?? node.Status ?? ""),
          isActive: node.isActive ?? node.IsActive,
          url: String(node.url ?? node.Url ?? ""),
        });
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") visit(v, depth + 1);
    }
  }

  visit(data, 0);
  return rows;
}

function sampleWholesaleOrder() {
  return {
    orderId: `DEBUG-ORD-${Date.now()}`,
    date: new Date().toISOString(),
    orderType: "wholesale",
    company: "ООО «Отладка Telegram»",
    inn: "7707083893",
    account: "40702810900000000001",
    bik: "044525225",
    contact: "Тестовый контакт",
    phone: "+79991234567",
    address: "г. Москва, ул. Примерная, д. 1",
    delivery_address: "г. Москва, ул. Доставки, д. 2",
    delivery_company: "СДЭК",
    delivery_method: "ПВЗ",
    items: [
      {
        name: "Тестовая позиция",
        type: "grain",
        kg: 2,
        packs200: 1,
        subtotal: 5000,
        category: "Фильтр",
      },
    ],
    total: 5000,
  };
}

/** @param {import("express").Express} app */
export function registerDebugRoutes(app) {
  /** Только DNS (без TCP к Telegram): видно, резолвится ли api.telegram.org с VPS. */
  app.get("/api/debug/telegram/dns", async (_req, res) => {
    const host = "api.telegram.org";
    try {
      const v4 = await resolve4(host);
      res.json({
        ok: true,
        host,
        aRecordsV4: v4,
        note: "Если адреса есть, а network-probe даёт ETIMEDOUT — до Telegram блокируют TCP 443 (фаервол), а не DNS.",
      });
    } catch (e) {
      res.json({
        ok: false,
        host,
        error: String(e?.message || e),
        code: e?.code,
      });
    }
  });

  app.get("/api/debug/telegram/status", async (_req, res) => {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    const relayUrl = (process.env.TELEGRAM_RELAY_URL || "").trim();
    const relaySecret = (process.env.TELEGRAM_RELAY_SECRET || "").trim();
    const relayConfigured = Boolean(relayUrl && relaySecret);

    let getMe = null;
    if (token && !relayConfigured) {
      try {
        const url = `https://api.telegram.org/bot${token}/getMe`;
        const gr = await Promise.race([
          ipv4HttpsRequest(url, { method: "GET" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("getMe timeout 8s")), 8000),
          ),
        ]);
        const gj = await gr.json();
        getMe = {
          http: gr.status,
          ok: gj.ok === true,
          username: gj.result?.username,
          botId: gj.result?.id,
          error: gj.ok ? undefined : gj.description || gj,
        };
      } catch (e) {
        getMe = { ok: false, ...serializeFetchError(e) };
      }
    } else if (token && relayConfigured) {
      getMe = {
        ok: null,
        skipped: true,
        note: "getMe не вызывается при настроенном relay — проверка send через POST /api/debug/telegram/ping",
      };
    }

    const hints = [];
    const proxyOn = Boolean((process.env.TELEGRAM_HTTPS_PROXY || process.env.HTTPS_PROXY || "").trim());
    const getMeTimeout =
      getMe &&
      !getMe.ok &&
      (getMe.codes?.includes("ETIMEDOUT") ||
        String(getMe.errorSummary || "").includes("ETIMEDOUT"));

    if (relayConfigured) {
      hints.push(
        "Настроен TELEGRAM_RELAY_URL: реальная отправка идёт через relay (например Supabase Edge), не напрямую с VPS. Поле getMe ниже проверяет только прямой доступ с VPS к api.telegram.org — при работающем relay оно может оставаться с ошибкой.",
      );
      try {
        const relayHost = new URL(relayUrl).hostname;
        const v4 = await resolve4(relayHost);
        hints.push(`Relay DNS OK: ${relayHost} → ${v4.slice(0, 2).join(", ")}`);
      } catch (e) {
        hints.push(
          `КРИТИЧНО: relay-хост не резолвится (${String(e?.message || e)}). Обновите TELEGRAM_RELAY_URL в GitHub Secrets / .env на рабочий Supabase project-ref и задеплойте functions/telegram-relay.`,
        );
      }
    }

    if (!token || !chatId) {
      if (!relayConfigured) {
        hints.push(
          "Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID на сервере (файл .env в корне проекта рядом с package.json), затем pm2 restart site-api --update-env. Либо только TELEGRAM_RELAY_URL + TELEGRAM_RELAY_SECRET для отправки через relay (Supabase Edge).",
        );
      }
    } else if (getMeTimeout) {
      hints.push(
        "Сеть: ETIMEDOUT до api.telegram.org — с VPS не устанавливается HTTPS к Telegram (это не «неверный токен»). Обычно блокировка исходящего 443 у хостинга.",
      );
      if (!proxyOn && !relayConfigured) {
        hints.push(
          "Решение: открыть у Reg.ru исходящий доступ к api.telegram.org:443; или TELEGRAM_HTTPS_PROXY / HTTPS_PROXY; или TELEGRAM_RELAY_URL (Supabase Edge `telegram-relay`) + TELEGRAM_RELAY_SECRET; затем pm2 restart site-api --update-env.",
        );
      } else if (proxyOn) {
        hints.push(
          "Прокси в .env уже задан, но таймаут — проверьте URL, логин/пароль и что с VPS до хоста прокси открыт нужный порт.",
        );
      }
      hints.push(`Когда сеть к Telegram заработает: TELEGRAM_CHAT_ID — ${chatIdHint(chatId)}`);
    } else {
      hints.push(`TELEGRAM_CHAT_ID: ${chatIdHint(chatId)}`);
      if (getMe && !getMe.ok) {
        hints.push("getMe не прошёл — проверьте TELEGRAM_BOT_TOKEN или текст ошибки в поле error.");
      } else if (getMe?.ok) {
        hints.push(`Бот @${getMe.username || "?"} — добавьте его в канал админом с правом «Публиковать сообщения».`);
      }
    }

    let relayHostPreview = null;
    if (relayUrl) {
      try {
        relayHostPreview = maskMiddle(new URL(relayUrl).host, 6);
      } catch {
        relayHostPreview = "invalid_url";
      }
    }

    res.json({
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId),
      tokenLength: token.length,
      chatIdLength: chatId.length,
      tokenPreview: token ? maskMiddle(token, 6) : null,
      chatIdPreview: chatId ? maskMiddle(chatId, 4) : null,
      relayConfigured,
      relayUrlHostPreview: relayHostPreview,
      hasRelaySecret: Boolean(relaySecret),
      nodeEnv: process.env.NODE_ENV || "",
      outboundProxyConfigured: proxyOn,
      getMe,
      hints,
    });
  });

  /** Проверка TCP/TLS до api.telegram.org (без токена в URL). */
  app.post("/api/debug/telegram/network-probe", async (_req, res) => {
    const url = "https://api.telegram.org/";
    try {
      const r = await ipv4HttpsRequest(url, { method: "GET" });
      res.json({
        ok: true,
        telegramHttpStatus: r.status,
        note: "Соединение с api.telegram.org установлено (IPv4). Если раньше был ETIMEDOUT через fetch — проверьте ping снова.",
      });
    } catch (e) {
      res.json({
        ok: false,
        url,
        ...serializeFetchError(e),
        hint: "Если снова ETIMEDOUT — у провайдера/VPS закрыт исходящий HTTPS к api.telegram.org; нужен другой хостинг или HTTP(S)-прокси.",
      });
    }
  });

  app.post("/api/debug/telegram/ping", async (req, res) => {
    const message =
      (req.body && typeof req.body.message === "string" && req.body.message.trim()) ||
      "🔧 <b>Тест Telegram</b>\nСообщение со страницы /debug API.";
    const result = await sendTelegramHtml(message.slice(0, 4000));
    res.json({ ok: result.ok, result });
  });

  app.post("/api/debug/telegram/wholesale-sample", async (req, res) => {
    const html = formatWholesaleOrderMessage(sampleWholesaleOrder());
    const result = await sendTelegramHtml(html);
    res.json({ ok: result.ok, result, htmlChars: html.length });
  });

  /**
   * Точка: Get Retailers (интернет-эквайринг) — в ответе у каждой точки есть merchantId и terminalId.
   * GET https://enter.tochka.com/uapi/acquiring/v1.0/retailers
   */
  app.get("/api/debug/tochka/retailers", async (_req, res) => {
    const jwtToken = (process.env.TOCHKA_JWT_TOKEN || "").trim();
    const customerCode = (process.env.TOCHKA_CUSTOMER_CODE || "").trim();
    if (!jwtToken) {
      return res.status(400).json({
        ok: false,
        error: "Нет TOCHKA_JWT_TOKEN в .env на API.",
      });
    }
    const url = new URL("https://enter.tochka.com/uapi/acquiring/v1.0/retailers");
    if (customerCode) {
      url.searchParams.set("customerCode", customerCode);
    }
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const data = await response.json().catch(() => ({}));
      const summary = response.ok ? summarizeTochkaRetailersResponse(data) : [];
      return res.status(response.ok ? 200 : response.status).json({
        ok: response.ok,
        http: response.status,
        requestUrl: url.origin + url.pathname + (url.search || ""),
        hasCustomerCodeQuery: Boolean(customerCode),
        summary,
        hint:
          summary.length > 0
            ? "Скопируйте terminalId для выбранного merchantId в TOCHKA_TERMINAL_ID (и merchant в TOCHKA_MERCHANT_ID)."
            : response.ok
              ? "Пар merchantId/terminalId в ответе не найдены — смотрите поле raw (структура могла измениться)."
              : undefined,
        raw: data,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ ok: false, error: msg });
    }
  });

  /** СДЭК: проверка OAuth (без утечки секрета). */
  app.get("/api/debug/cdek/status", async (_req, res) => {
    const account = (process.env.CDEK_ACCOUNT || "").trim();
    const secret = (process.env.CDEK_SECRET || "").trim();
    const hints = [];
    const cdekApiBase = getCdekApiBase();
    const base = {
      cdekApiBase,
      hasAccount: Boolean(account),
      hasSecret: Boolean(secret),
      accountLength: account.length,
      secretLength: secret.length,
      accountPrefix: account.length >= 4 ? `${account.slice(0, 4)}…` : account ? "••••" : "",
    };
    if (!account || !secret) {
      hints.push(
        "В .env на API (VPS) задайте CDEK_ACCOUNT и CDEK_SECRET — «Идентификатор» и «Пароль» интеграции API 2.0 в lk.cdek.ru (не логин договора). После правки: pm2 restart site-api --update-env.",
      );
      return res.json({ ok: false, oauth: "missing_env", hints, ...base });
    }
    try {
      await getCdekToken();
      return res.json({ ok: true, oauth: "ok", hints, ...base });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (String(msg).toLowerCase().includes("no such account secure")) {
        hints.push(
          "Сообщение «No such account secure»: чаще всего **не та среда**. Тестовые ключи СДЭК работают только с https://api.edu.cdek.ru/v2 — в .env задайте CDEK_API_URL=https://api.edu.cdek.ru/v2 (или CDEK_USE_TEST_API=1). Боевые ключи — только с https://api.cdek.ru/v2 (значение по умолчанию). Пары нельзя мешать.",
        );
      }
      if (String(msg).includes("401")) {
        hints.push(
          "401: пара Account / Secure password не принята СДЭК. В lk.cdek.ru → Интеграция → API возьмите «Идентификатор» (Account) и «Секретный ключ» (Secure password), не логин/пароль входа в ЛК. В .env без кавычек, без пробела в конце строки; не перепутайте CDEK_ACCOUNT и CDEK_SECRET. После правки: pm2 restart site-api --update-env.",
        );
      }
      return res.json({ ok: false, oauth: "error", error: msg, hints, ...base });
    }
  });

  /**
   * Реально создаёт заказ в ЛК СДЭК (номер DEBUG-…). Только для ручной проверки с /debug.
   */
  app.post("/api/debug/cdek/test-order", async (req, res) => {
    const body = req.body || {};
    const pvzCode = String(body.pvzCode || "").trim();
    const tariffCode = body.tariffCode != null ? Number(body.tariffCode) : undefined;
    if (!pvzCode) {
      return res.status(400).json({ error: "Нужен pvzCode (код ПВЗ из списка или карты)" });
    }
    const orderId = `DEBUG-${Date.now()}`;
    const items = [
      {
        id: "debug-item",
        name: "Тест /debug СДЭК",
        price: 100,
        quantity: 1,
        weight: 500,
        length: 20,
        width: 15,
        height: 10,
      },
    ];
    const r = await createCdekOrder(
      orderId,
      "Тест Отладки",
      "+79991234567",
      { pvzCode, tariffCode: Number.isFinite(tariffCode) ? tariffCode : undefined },
      items,
    );
    res.json({
      orderId,
      ...r,
      note: "Проверьте заказ в https://lk.cdek.ru/ (через 1–2 минуты). Не забудьте отменить тестовый, если политика СДЭК требует.",
    });
  });

  /**
   * Минимальная реальная оплата 10 ₽: самовывоз (без СДЭК), заказ в БД, ссылка Точка. Только /debug.
   * Тело (опционально): customerName, customerPhone, customerEmail — иначе разумные дефолты.
   */
  app.post("/api/debug/retail/tochka-pay-10rub", async (req, res) => {
    try {
      const b = req.body && typeof req.body === "object" ? req.body : {};
      const customerName =
        typeof b.customerName === "string" && b.customerName.trim()
          ? b.customerName.trim()
          : "Тест оплаты 10 ₽ (/debug)";
      const customerPhone =
        typeof b.customerPhone === "string" && b.customerPhone.trim()
          ? b.customerPhone.trim()
          : "+79991234567";
      const customerEmail =
        typeof b.customerEmail === "string" && b.customerEmail.trim()
          ? b.customerEmail.trim()
          : "debug@coffeenechai.ru";
      const orderId = `DEBUG-10RUB-${Date.now()}`;
      const saved = await createRetailOrderFromCheckout({
        orderId,
        customerName,
        customerPhone,
        customerEmail,
        items: [
          {
            product: {
              id: "debug-pay-10rub",
              name: "Тестовая оплата 10 ₽ (страница /debug)",
              category: "Зерно",
              price: 10,
              packageWeight: 200,
              packageLength: 15,
              packageWidth: 10,
              packageHeight: 8,
              imageUrl: "",
            },
            quantity: 1,
          },
        ],
      });
      const payUrl = saved.tochkaPaymentUrl || saved.tochka_payment_url;
      const payErr = saved.tochkaPaymentError || saved.tochka_payment_error;
      const note = payUrl
        ? "Самовывоз, доставка 0 ₽, сумма 10 ₽. В Telegram — уведомление о заказе; «оплата получена» — когда в ЛК Точки настроен вебхук на POST …/api/tochka/webhook и оплата прошла."
        : `Самовывоз 10 ₽. ${typeof payErr === "string" && payErr.trim() ? payErr.trim() : "Ссылка Точка не создана — см. TOCHKA_* в .env и логи API."}`;
      await telegramNotify("retail_order", formatRetailOrderMessage(saved));
      res.json({
        ...saved,
        note,
      });
    } catch (e) {
      const code = e?.statusCode === 400 ? 400 : 500;
      res.status(code).json({ error: e?.message || String(e) });
    }
  });

  /**
   * Как POST /api/retail/orders с полным чекаутом (только /debug). Telegram — как на витрине (новый заказ).
   * Тело — как у витрины: customerName, customerPhone, customerEmail?, items[].product, deliveryInfo (pvzCode, city, cost, …).
   */
  app.post("/api/debug/retail/tochka-checkout", async (req, res) => {
    try {
      const saved = await createRetailOrderFromCheckout(req.body || {});
      const payUrl = saved.tochkaPaymentUrl || saved.tochka_payment_url;
      const payErr = saved.tochkaPaymentError || saved.tochka_payment_error;
      const hasTerminalEnv = Boolean((process.env.TOCHKA_TERMINAL_ID || "").trim());
      const baseNote =
        "Заказ сохранён в БД; при наличии ссылок откройте оплату Точка. В Telegram уйдёт уведомление о заказе; об оплате — после вебхука Точки.";
      let note = baseNote;
      if (!payUrl) {
        if (typeof payErr === "string" && payErr.trim()) {
          note = `${baseNote} Ошибка/пропуск Точки: ${payErr.trim()}`;
        } else if (!hasTerminalEnv) {
          note = `${baseNote} Ссылка не создаётся: в .env на API нет TOCHKA_TERMINAL_ID. На /debug → раздел Точка → кнопка «Get Retailers (terminalId)», скопируйте terminalId для вашего merchantId, затем pm2 restart site-api --update-env.`;
        }
      }
      await telegramNotify("retail_order", formatRetailOrderMessage(saved));
      res.json({
        ...saved,
        note,
      });
    } catch (e) {
      const code = e?.statusCode === 400 ? 400 : 500;
      res.status(code).json({ error: e?.message || String(e) });
    }
  });
}
