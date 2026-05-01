/**
 * HTTPS-запрос с принудительным IPv4 (Node fetch на части VPS даёт ETIMEDOUT при IPv6).
 * Совместимость с минимальным подмножеством fetch: ok, status, json(), text().
 */

import https from "node:https";
import { URL } from "node:url";

/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [opts]
 */
export function ipv4HttpsRequest(url, opts = {}) {
  const { method = "GET", headers = {}, body } = opts;
  const u = new URL(url);

  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (body != null && body !== "") {
      h["Content-Length"] = String(Buffer.byteLength(body));
    }

    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        family: 4,
        headers: h,
        servername: u.hostname,
        timeout: 28000,
      },
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
