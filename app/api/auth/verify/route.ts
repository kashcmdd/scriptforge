import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const user = db
    .prepare("SELECT id, verify_token_expires FROM users WHERE verify_token = ?")
    .get(token) as { id: number; verify_token_expires: string } | undefined;

  if (!user || new Date(user.verify_token_expires) < new Date()) {
    return NextResponse.json({ error: "That verification link is invalid or expired." }, { status: 400 });
  }

  db.prepare(
    "UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?"
  ).run(user.id);

  return NextResponse.redirect(new URL("/scripts?verified=1", req.url));
}
