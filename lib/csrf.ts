import { NextRequest, NextResponse } from "next/server";

export const CSRF_COOKIE = "csrf_token";

/**
 * Double-submit CSRF check: every state-changing API call must echo the
 * `csrf_token` cookie back in the `x-csrf-token` header. Because the
 * cookie is HttpOnly + SameSite=Lax, a cross-site attacker can neither
 * read it nor script a request that carries it, so a verified match means
 * the request came from our own app. Login/signup/reset entry points are
 * deliberately exempt (no session exists yet to protect, and they are
 * rate-limited already).
 */
export function csrfFails(request: NextRequest): boolean {
  const token = request.headers.get("x-csrf-token");
  const cookie = request.cookies.get(CSRF_COOKIE)?.value;
  return !token || !cookie || token !== cookie;
}

export function csrfRejection() {
  return NextResponse.json({ error: "CSRF token missing or invalid." }, { status: 403 });
}