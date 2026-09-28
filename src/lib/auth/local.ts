import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * LOCAL DEVELOPMENT auth, used only when Supabase isn't configured (e.g. running
 * the app offline or in CI). Sessions are HMAC-signed cookies; passwords are bcrypt
 * hashes in the local auth.users table. Production always uses Supabase Auth.
 */
export const LOCAL_COOKIE = "aimtrack_local_session";

export function signSession(userId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, email, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", env.authSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): { id: string; email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", env.authSecret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - data.iat > 30 * 86_400_000) return null;
    return { id: data.sub, email: data.email };
  } catch {
    return null;
  }
}
