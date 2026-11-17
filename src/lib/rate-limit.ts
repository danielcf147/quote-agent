/**
 * In-memory sliding-window limiter for live mode.
 *
 * Serverless platforms may run several instances, each with its own memory, so
 * this is a hard cap per instance. The daily budget bounds the worst case on
 * every instance; the README explains how to make the limit global.
 */
const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function checkRateLimit(
  key: string,
  { perWindow, windowMs, dailyBudget }: { perWindow: number; windowMs: number; dailyBudget: number },
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number; reason: string } {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= dailyBudget) {
    return {
      ok: false,
      retryAfterSec: 3600,
      reason: "The live demo's daily budget is used up. Try again tomorrow, or use your own key.",
    };
  }

  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= perWindow) {
    hits.set(key, recent);
    return {
      ok: false,
      retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000),
      reason: `Rate limit reached (${perWindow} requests per ${Math.round(windowMs / 60000)} min).`,
    };
  }

  recent.push(now);
  hits.set(key, recent);
  dayCount++;
  if (hits.size > 5000) {
    // Bound memory: drop the oldest tracked client.
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return { ok: true, remaining: perWindow - recent.length };
}
