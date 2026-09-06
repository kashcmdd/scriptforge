import { NextRequest, NextResponse } from "next/server";
import { csrfFails, csrfRejection } from "@/lib/csrf";

const EXEMPT = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/request-reset",
  "/api/auth/reset-password",
]);

export function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }
  if (EXEMPT.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (csrfFails(request)) {
    return csrfRejection();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};