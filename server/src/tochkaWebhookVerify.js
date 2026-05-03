import { importJWK, jwtVerify } from "jose";

const TOCHKA_WEBHOOK_JWK_URL = "https://enter.tochka.com/doc/openapi/static/keys/public";

/** @type {import('jose').KeyLike | null} */
let cachedPublicKey = null;

async function getTochkaWebhookPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await fetch(TOCHKA_WEBHOOK_JWK_URL);
  if (!res.ok) {
    throw new Error(`Tochka webhook public key HTTP ${res.status}`);
  }
  const jwk = await res.json();
  cachedPublicKey = await importJWK(jwk, "RS256");
  return cachedPublicKey;
}

/**
 * Проверка тела вебхука Точки: JWT RS256, см. https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vebhuki
 * @param {string} tokenString — сырая строка из тела POST (Content-Type: text/plain).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function verifyTochkaWebhookJwt(tokenString) {
  const key = await getTochkaWebhookPublicKey();
  const { payload } = await jwtVerify(tokenString.trim(), key, { algorithms: ["RS256"] });
  return /** @type {Record<string, unknown>} */ (payload);
}
