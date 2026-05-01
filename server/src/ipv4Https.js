/**
 * HTTPS к внешним API (Telegram): IPv4 напрямую или через TELEGRAM_HTTPS_PROXY / HTTPS_PROXY.
 * Совместимость с минимальным подмножеством fetch: ok, status, json(), text().
 */

import https from "node:https";
import { URL } from "node:url";
import { HttpsProxyAgent } from "https-proxy-agent";

function outboundProxyUrl() {
  return (process.env.TELEGRAM_HTTPS_PROXY || process.env.HTTPS_PROXY || "").trim();
}

/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [opts]
 */
export function ipv4HttpsRequest(url, opts = {}) {
  const { method = "GET", headers = {}, body } = opts;
  const u = new URL(url);
  const proxy = outboundProxyUrl();
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (body != null && body !== "") {
      h["Content-Length"] = String(Buffer.byteLength(body));
    }

    /** @type {import("node:https").RequestOptions} */
    const opt = {
      hostname: u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      method,
      headers: h,
      servername: u.hostname,
      timeout: agent ? 60000 : 28000,
    };
    if (agent) {
      opt.agent = agent;
    } else {
      opt.family = 4;
    }

    const req = https.request(
      opt,
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString("utf8");
          const status = res.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
              try {
                return JSON.parse(text);
              } catch {
                return {};
              }
            },
            text: async () => text,
          });
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      const e = new Error("ETIMEDOUT");
      e.code = "ETIMEDOUT";
      reject(e);
    });

    if (body != null && body !== "") req.write(body);
    req.end();
  });
}
