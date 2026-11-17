/** Live mode is off unless explicitly enabled and a server key is present. */
export function liveConfig() {
  const enabled = process.env.LIVE_MODE_ENABLED === "true" && !!process.env.OPENAI_API_KEY;
  const int = (v: string | undefined, d: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled,
    perWindow: int(process.env.LIVE_RATE_LIMIT, 5),
    windowMs: int(process.env.LIVE_RATE_WINDOW_MINUTES, 60) * 60_000,
    dailyBudget: int(process.env.LIVE_DAILY_BUDGET, 200),
  };
}
