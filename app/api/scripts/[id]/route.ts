import { NextRequest, NextResponse } from "next/server";
import { db, updateScript } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { titleIssue, gameIssue, descriptionIssue } from "@/lib/validate";

type Params = { params: { id: string } };

function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const id = parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }
  const script = db
    .prepare(
      "SELECT id, title, game, description, body, downloads, version, created_at, updated_at FROM scripts WHERE id = ?"
    )
    .get(id);
  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }
  return NextResponse.json({ script });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const id = parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }

  const existing = db.prepare("SELECT id, created_by FROM scripts WHERE id = ?").get(id) as
    | { id: number; created_by: number | null }
    | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const isOwner = existing.created_by === session.userId;
  if (!isAdmin(session.email) && !isOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { title, game, description, body, changelog } = await req.json().catch(() => ({}));

  if (title !== undefined) {
    const err = titleIssue(title);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  if (game !== undefined) {
    const err = gameIssue(game);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  if (description !== undefined) {
    const err = descriptionIssue(description);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  if (body !== undefined) {
    if (typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "Script body is required." }, { status: 400 });
    }
    if (body.length > 200_000) {
      return NextResponse.json({ error: "Script body is too large." }, { status: 400 });
    }
  }
  if (changelog !== undefined) {
    if (typeof changelog !== "string" || changelog.length > 500) {
      return NextResponse.json({ error: "Changelog is too long (max 500 characters)." }, { status: 400 });
    }
  }

  const updated = updateScript(id, {
    title: title === undefined ? undefined : title.trim(),
    game: game === undefined ? undefined : game.trim(),
    description:
      description === undefined
        ? undefined
        : typeof description === "string" && description.trim()
          ? description.trim()
          : null,
    body: body === undefined ? undefined : (body as string),
    changelog: typeof changelog === "string" ? changelog.trim() : null,
    createdBy: session.userId,
  });

  if (!updated) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, version: updated.version });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const id = parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }

  const script = db.prepare("SELECT created_by FROM scripts WHERE id = ?").get(id) as
    | { created_by: number | null }
    | undefined;

  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const isOwner = script.created_by === session.userId;
  if (!isAdmin(session.email) && !isOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM favorites WHERE script_id = ?").run(id);
    db.prepare("DELETE FROM script_versions WHERE script_id = ?").run(id);
    db.prepare("DELETE FROM scripts WHERE id = ?").run(id);
  });
  tx();

  return NextResponse.json({ ok: true });
}