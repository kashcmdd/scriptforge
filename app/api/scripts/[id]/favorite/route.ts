import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in to favorite scripts." }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }

  const script = db.prepare("SELECT id FROM scripts WHERE id = ?").get(id);
  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const { favorited } = await req.json().catch(() => ({}));

  const exists = db
    .prepare("SELECT 1 FROM favorites WHERE user_id = ? AND script_id = ?")
    .get(session.userId, id);

  if (favorited === true && !exists) {
    db.prepare("INSERT INTO favorites (user_id, script_id) VALUES (?, ?)").run(session.userId, id);
  } else if (favorited === false && exists) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND script_id = ?").run(session.userId, id);
  }

  return NextResponse.json({ ok: true, favorited: favorited === true });
}