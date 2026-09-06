import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const { display_name } = await req.json().catch(() => ({}));
  const name = typeof display_name === "string" ? display_name.trim() : "";
  if (name.length > 48) {
    return NextResponse.json({ error: "Display name is too long (max 48 characters)." }, { status: 400 });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(name || null, session.userId);
  return NextResponse.json({ ok: true, displayName: name || null });
}