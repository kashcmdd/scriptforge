import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// Fail loudly instead of silently running on a shared dev secret —
// a forgotten .env.local should never make it into a real deployment.
const secretValue = process.env.AUTH_SECRET;
if (!secretValue) {
  throw new Error(
    "AUTH_SECRET is not set. Add it to .env.local (e.g. `openssl rand -hex 32`) before starting the app."
  );
}
const secret = new TextEncoder().encode(secretValue);
const COOKIE_NAME = "sf_session";

export async function createSession(userId: number, email: string) {
  const row = db.prepare("SELECT session_version FROM users WHERE id = ?").get(userId) as
    | { session_version: number }
    | undefined;
  const tv = row ? row.session_version : 0;
  const token = await new SignJWT({ userId, email, tv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const { userId, email, tv } = payload as { userId: number; email: string; tv?: number };
    const row = db
      .prepare("SELECT session_version FROM users WHERE id = ?")
      .get(userId) as { session_version: number } | undefined;
    // A bumped session_version (password changed/reset) invalidates this token.
    if (!row || row.session_version !== (tv ?? 0)) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}
