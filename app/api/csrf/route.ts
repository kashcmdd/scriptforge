import { NextResponse } from "next/server";
import crypto from "crypto";
import { CSRF_COOKIE } from "@/lib/csrf";

export async function GET() {
  const token = crypto.randomBytes(32).toString("hex");
  const res = NextResponse.json({ token });
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}