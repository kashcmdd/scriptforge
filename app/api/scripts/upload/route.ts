import { NextRequest, NextResponse } from "next/server";
import { db, createScript } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { titleIssue, gameIssue, descriptionIssue } from "@/lib/validate";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const user = db
    .prepare("SELECT id, email_verified FROM users WHERE id = ?")
    .get(session.userId) as { id: number; email_verified: number } | undefined;
  if (!user || !user.email_verified) {
    return NextResponse.json({ error: "Verify your email before uploading scripts." }, { status: 403 });
  }

  const { title, game, description, body } = await req.json().catch(() => ({}));

  const titleErr = titleIssue(title);
  if (titleErr) return NextResponse.json({ error: titleErr }, { status: 400 });

  const gameErr = gameIssue(game);
  if (gameErr) return NextResponse.json({ error: gameErr }, { status: 400 });

  const descErr = descriptionIssue(description);
  if (descErr) return NextResponse.json({ error: descErr }, { status: 400 });

  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Script body is required." }, { status: 400 });
  }
  if (body.length > 200_000) {
    return NextResponse.json({ error: "Script body is too large." }, { status: 400 });
  }

  const id = createScript({
    title: title.trim(),
    game: game.trim(),
    description: typeof description === "string" && description.trim() ? description.trim() : null,
    body,
    createdBy: session.userId,
  });

  return NextResponse.json({ ok: true, id, version: 1 });
}