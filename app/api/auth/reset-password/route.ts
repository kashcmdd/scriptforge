import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, bumpSessionVersion } from "@/lib/db";
import { passwordIssue } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "reset-password"), 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { token, password } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Missing or invalid token." }, { status: 400 });
  }
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    return NextResponse.json({ error: pwIssue }, { status: 400 });
  }

  const user = db
    .prepare("SELECT id, reset_token_expires FROM users WHERE reset_token = ?")
    .get(token) as { id: number; reset_token_expires: string } | undefined;

  if (!user || new Date(user.reset_token_expires) < new Date()) {
    return NextResponse.json({ error: "That reset link is invalid or expired." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?"
  ).run(hash, user.id);
  bumpSessionVersion(user.id);

  return NextResponse.json({ ok: true });
}
