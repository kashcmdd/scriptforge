import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const scripts = db
    .prepare("SELECT id, title, game FROM scripts ORDER BY created_at DESC, id DESC")
    .all() as { id: number; title: string; game: string }[];
  return NextResponse.json({ scripts });
}