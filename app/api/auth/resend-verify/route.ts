import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const limit = rateLimit(clientKey(req, "resend-verify"), 4, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const user = db
    .prepare("SELECT id, email_verified FROM users WHERE id = ?")
    .get(session.userId) as { id: number; email_verified: number } | undefined;

  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (user.email_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?").run(
    token,
    expires,
    user.id
  );

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  sendMail(
    session.email,
    "Verify your ScriptForge account",
    `Confirm your email: ${appUrl}/api/auth/verify?token=${token}`
  ).catch((err) => logger.error("verify email send failed", { err: String(err) }));

  return NextResponse.json({ ok: true, alreadyVerified: false });
}