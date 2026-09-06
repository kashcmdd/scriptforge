import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    const third = rateLimit(key, 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
    vi.useRealTimers();
  });
});
