import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== true) {
    return NextResponse.json({ error: "Confirmation required to delete your account." }, { status: 400 });
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM favorites WHERE user_id = ?").run(session.userId);
    db.prepare("UPDATE scripts SET created_by = NULL WHERE created_by = ?").run(session.userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(session.userId);
  });
  tx();

  clearSession();
  return NextResponse.json({ ok: true });
}