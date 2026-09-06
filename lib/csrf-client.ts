let cached: string | null = null;

export async function csrfToken(): Promise<string> {
  if (cached) return cached;
  const res = await fetch("/api/csrf", { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error("Could not get a CSRF token.");
  const data = await res.json();
  cached = typeof data.token === "string" ? data.token : null;
  if (!cached) throw new Error("CSRF token missing from response.");
  return cached;
}

/**
 * Headers for any state-changing fetch. The CSRF cookie is HttpOnly, so we
 * fetch /api/csrf (once, cached) to learn the value and echo it back; the
 * middleware verifies it against the cookie before the request proceeds.
 */
export async function csrfHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  return {
    "x-csrf-token": await csrfToken(),
    ...(extra || {}),
  };
}