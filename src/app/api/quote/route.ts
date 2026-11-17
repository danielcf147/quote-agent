import embeddings from "@/data/catalog-embeddings.json";
import { LIMITS } from "@/lib/config";
import { liveConfig } from "@/lib/live";
import { OpenAIError } from "@/lib/openai";
import { PipelineError, runQuotePipeline } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import type { EmbeddingIndex } from "@/lib/types";

export const maxDuration = 30;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Live mode only. Bring-your-own-key requests never reach this server. */
export async function POST(req: Request) {
  const cfg = liveConfig();
  if (!cfg.enabled) return Response.json({ error: "Live mode is disabled on this deployment." }, { status: 404 });

  let input: unknown;
  try {
    ({ input } = await req.json());
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof input !== "string" || !input.trim()) {
    return Response.json({ error: "Write a purchase request first." }, { status: 400 });
  }
  if (input.length > LIMITS.live.maxChars) {
    return Response.json({ error: `Live mode accepts up to ${LIMITS.live.maxChars} characters.` }, { status: 413 });
  }

  const limit = checkRateLimit(clientIp(req), cfg);
  if (!limit.ok) {
    return Response.json(
      { error: limit.reason },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const result = await runQuotePipeline({
      input,
      apiKey: process.env.OPENAI_API_KEY!,
      index: embeddings as EmbeddingIndex,
      mode: "live",
      maxItems: LIMITS.live.maxItems,
      signal: AbortSignal.timeout(25_000),
    });
    return Response.json(result, { headers: { "X-RateLimit-Remaining": String(limit.remaining) } });
  } catch (err) {
    if (err instanceof PipelineError) return Response.json({ error: err.message }, { status: 422 });
    if (err instanceof OpenAIError) {
      return Response.json({ error: "The model provider returned an error. Try again shortly." }, { status: 502 });
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return Response.json({ error: "The request took too long. Try a shorter request." }, { status: 504 });
    }
    console.error(err);
    return Response.json({ error: "Could not reach the model provider. Try again shortly." }, { status: 502 });
  }
}
