import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    db.prepare("SELECT 1").get();
    return NextResponse.json({
      ok: true,
      status: "healthy",
      db: "ok",
      uptime: Math.round(process.uptime()),
      now: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, status: "unhealthy", db: "error", error: String(err) },
      { status: 503 }
    );
  }
}