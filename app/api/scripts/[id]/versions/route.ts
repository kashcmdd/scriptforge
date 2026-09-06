import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid script id." }, { status: 400 });
  }

  const script = db.prepare("SELECT id FROM scripts WHERE id = ?").get(id);
  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const versions = db
    .prepare("SELECT version, changelog, created_at FROM script_versions WHERE script_id = ? ORDER BY version DESC")
    .all(id);
  return NextResponse.json({ versions });
}