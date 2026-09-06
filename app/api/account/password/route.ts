import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, bumpSessionVersion } from "@/lib/db";
import { getSession, createSession } from "@/lib/auth";
import { passwordIssue } from "@/lib/validate";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const { old_password, new_password } = await req.json().catch(() => ({}));

  const issue = passwordIssue(new_password);
  if (issue) {
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .get(session.userId) as { id: number; password_hash: string } | undefined;
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const valid = await bcrypt.compare(typeof old_password === "string" ? old_password : "", user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const hash = await bcrypt.hash(new_password as string, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);

  // Invalidate every other session; reissue this one with the new version.
  bumpSessionVersion(user.id);
  await createSession(user.id, session.email);

  return NextResponse.json({ ok: true });
}