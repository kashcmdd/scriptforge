import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in to download scripts." }, { status: 401 });
  }

  const user = db
    .prepare("SELECT id, email_verified FROM users WHERE id = ?")
    .get(session.userId) as { id: number; email_verified: number } | undefined;
  if (!user || !user.email_verified) {
    return NextResponse.json({ error: "Verify your email to download scripts." }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }

  const script = db.prepare("SELECT title, body FROM scripts WHERE id = ?").get(id) as
    | { title: string; body: string }
    | undefined;

  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  db.prepare("UPDATE scripts SET downloads = downloads + 1 WHERE id = ?").run(id);

  const filename = script.title.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() + ".gpc";
  return new NextResponse(script.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}