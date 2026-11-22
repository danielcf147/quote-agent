import meta from "@/data/embeddings-meta.json";
import { PROVIDERS } from "./config";
import type { EmbeddingMeta } from "./types";

/**
 * Live mode is off unless explicitly enabled and the server has a key for the
 * provider the catalog was embedded with.
 */
export function liveConfig() {
  const provider = (meta as EmbeddingMeta).provider;
  const apiKey = provider ? process.env[PROVIDERS[provider].envKey] : undefined;
  const enabled = process.env.LIVE_MODE_ENABLED === "true" && !!apiKey;
  const int = (v: string | undefined, d: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled,
    apiKey,
    perWindow: int(process.env.LIVE_RATE_LIMIT, 5),
    windowMs: int(process.env.LIVE_RATE_WINDOW_MINUTES, 60) * 60_000,
    dailyBudget: int(process.env.LIVE_DAILY_BUDGET, 200),
  };
}
