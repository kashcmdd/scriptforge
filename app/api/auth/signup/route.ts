import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { isValidEmail, passwordIssue } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "signup"), 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }

  const { email, password } = await req.json().catch(() => ({}));

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    return NextResponse.json({ error: pwIssue }, { status: 400 });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return NextResponse.json({ error: "Account already exists." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, verify_token, verify_token_expires) VALUES (?, ?, ?, ?)"
    )
    .run(email, hash, verifyToken, verifyExpires);

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  sendMail(
    email,
    "Verify your ScriptForge account",
    `Confirm your email: ${appUrl}/api/auth/verify?token=${verifyToken}`
  ).catch((err) => logger.error("verify email send failed", { err: String(err) }));

  await createSession(Number(result.lastInsertRowid), email);
  return NextResponse.json({ ok: true, emailVerified: false });
}
