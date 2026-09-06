type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimits() {
  buckets.clear();
}

/**
 * Fixed-window limiter. NOTE: this is in-memory and per-process —
 * it resets on restart and does NOT share state across multiple
 * server instances. Fine for a single-server deploy or dev; if you
 * run more than one instance behind a load balancer, replace this
 * with a shared store (Redis, Upstash, etc.) before relying on it.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true };
}

export function clientKey(req: Request, suffix: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${suffix}`;
}
