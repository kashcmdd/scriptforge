import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { isValidEmail } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "request-reset"), 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({}));

  // Always return the same response whether or not the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = NextResponse.json({
    ok: true,
    message: "If that email has an account, a reset link has been sent.",
  });

  if (!isValidEmail(email)) return genericResponse;

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: number }
    | undefined;
  if (!user) return genericResponse;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?").run(
    token,
    expires,
    user.id
  );

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  sendMail(
    email,
    "Reset your ScriptForge password",
    `Reset your password: ${appUrl}/reset-password?token=${token}`
  ).catch((err) => logger.error("reset email send failed", { err: String(err) }));

  return genericResponse;
}
