import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { isValidEmail } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "login"), 10, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const { email, password } = await req.json().catch(() => ({}));

  if (!isValidEmail(email) || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const user = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; password_hash: string } | undefined;

  // Always run bcrypt.compare even on a missing user, against a fixed
  // dummy hash, so response timing doesn't reveal whether an email exists.
  const dummyHash = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8i8g8g8g8g8g8g8g8g8g8g8g8g8g8g";
  const valid = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession(user.id, user.email);
  return NextResponse.json({ ok: true });
}
