import crypto from "node:crypto";

function secret() {
  return (
    process.env.JWT_SECRET ||
    process.env.RETAIL_AUTH_SECRET ||
    "dev-retail-auth-change-JWT_SECRET-in-production"
  );
}

/** @param {{ sub: string, email?: string, role?: string, exp: number }} payload */
export function signRetailToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, typ: "retail" }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyRetailToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.typ !== "retail") return null;
    if (payload.exp && Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
