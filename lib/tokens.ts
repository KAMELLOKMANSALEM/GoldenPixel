import crypto from "crypto";

// Random opaque token stored on a block for magic-link edit access.
export function randomToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// --- Signed tokens for admin magic-link sessions (HMAC, no DB needed) ---
function secret(): string {
  return process.env.TOKEN_SECRET || "dev-insecure-secret-change-me";
}

export function signAdmin(email: string, ttlMs = 1000 * 60 * 60 * 12): string {
  const exp = Date.now() + ttlMs;
  const payload = `${email}|${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyAdmin(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const payload = Buffer.from(body, "base64url").toString();
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const [email, expStr] = payload.split("|");
  if (!email || !expStr) return null;
  if (Date.now() > Number(expStr)) return null;
  return email;
}

export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
