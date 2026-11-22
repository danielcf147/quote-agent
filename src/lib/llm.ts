/**
 * Minimal clients for OpenAI and Gemini over fetch. No Node dependencies, so
 * the same code runs in the browser (bring-your-own-key), in the API route
 * (live mode) and in the build scripts.
 *
 * Chat goes through each provider's OpenAI-compatible Chat Completions API
 * with a strict JSON schema. Embeddings use each provider's native endpoint,
 * because Gemini's native API distinguishes documents from queries
 * (task types), which improves retrieval.
 */
import { PROVIDERS, type ProviderId } from "./config";

const OPENAI_URL = "https://api.openai.com/v1";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta";

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterSec = 0,
  ) {
    super(message);
  }
}

/** Overloaded or rate-limited: worth trying again after a pause. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const retryPolicy = {
  attempts: 3,
  baseDelayMs: 1000,
  /** Each attempt is abandoned after this long, so a stalled connection cannot hang forever. */
  timeoutMs: 20_000,
  onRetry: undefined as ((info: string) => void) | undefined,
};

/**
 * Batch scripts can afford to wait longer than an interactive request.
 * Defaults: 3 attempts of up to 20 s, waiting 1 s then 2 s (plus jitter) between them.
 */
export function configureRetries(opts: Partial<typeof retryPolicy>) {
  Object.assign(retryPolicy, opts);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function postJson<T>(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await postJsonOnce<T>(url, headers, body, signal);
    } catch (caught) {
      let err = caught;
      // Our own per-attempt timeout (not the caller's signal): report it as a retryable 504.
      if (!signal?.aborted && caught instanceof Error && (caught.name === "TimeoutError" || caught.name === "AbortError")) {
        err = new ProviderError(`No response within ${retryPolicy.timeoutMs / 1000} s`, 504);
      }
      const retryable = err instanceof ProviderError && RETRYABLE.has(err.status);
      if (!retryable || attempt >= retryPolicy.attempts || signal?.aborted) throw err;
      const retryAfterMs = (err as ProviderError).retryAfterSec * 1000;
      const backoff = retryPolicy.baseDelayMs * 2 ** (attempt - 1) * (0.8 + Math.random() * 0.4);
      const delay = Math.min(Math.max(backoff, retryAfterMs), 60_000);
      retryPolicy.onRetry?.(
        `${(err as ProviderError).status} ${(err as Error).message.slice(0, 80)} (attempt ${attempt}/${retryPolicy.attempts}, retrying in ${(delay / 1000).toFixed(1)} s)`,
      );
      await sleep(delay, signal);
    }
  }
}

async function postJsonOnce<T>(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(retryPolicy.timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const raw = await res.json();
      // Gemini's compatibility layer wraps errors in an array.
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data?.error?.message) message = data.error.message;
    } catch {
      // keep the generic message
    }
    const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
    throw new ProviderError(message, res.status, Number.isFinite(retryAfter) ? retryAfter : 0);
  }
  return (await res.json()) as T;
}

export type EmbeddingPurpose = "document" | "query";

export async function createEmbeddings(
  provider: ProviderId,
  apiKey: string,
  input: string[],
  purpose: EmbeddingPurpose,
  signal?: AbortSignal,
): Promise<{ vectors: number[][]; tokens: number }> {
  const cfg = PROVIDERS[provider];

  if (provider === "openai") {
    const data = await postJson<{
      data: { index: number; embedding: number[] }[];
      usage: { total_tokens: number };
    }>(
      `${OPENAI_URL}/embeddings`,
      { Authorization: `Bearer ${apiKey}` },
      { model: cfg.embeddingModel, input, dimensions: cfg.dimensions, encoding_format: "float" },
      signal,
    );
    const vectors = data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    return { vectors, tokens: data.usage.total_tokens };
  }

  const model = `models/${cfg.embeddingModel}`;
  const data = await postJson<{ embeddings: { values: number[] }[] }>(
    `${GEMINI_URL}/${model}:batchEmbedContents`,
    { "x-goog-api-key": apiKey },
    {
      requests: input.map((text) => ({
        model,
        content: { parts: [{ text }] },
        taskType: purpose === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
        outputDimensionality: cfg.dimensions,
      })),
    },
    signal,
  );
  // The native endpoint reports no token usage; ~4 characters per token is close enough for an estimate.
  const tokens = Math.ceil(input.reduce((n, t) => n + t.length, 0) / 4);
  return { vectors: data.embeddings.map((e) => e.values), tokens };
}

export async function createStructuredCompletion<T>(
  provider: ProviderId,
  apiKey: string,
  opts: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    signal?: AbortSignal;
  },
) {
  const cfg = PROVIDERS[provider];
  const url = provider === "openai" ? `${OPENAI_URL}/chat/completions` : `${GEMINI_URL}/openai/chat/completions`;
  const data = await postJson<{
    choices: { message: { content: string | null; refusal?: string | null } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  }>(
    url,
    { Authorization: `Bearer ${apiKey}` },
    {
      model: cfg.chatModel,
      temperature: 0,
      // Extraction needs little deliberation; the lowest thinking level keeps Gemini fast and cheap.
      ...(provider === "gemini" ? { reasoning_effort: "low" } : {}),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    },
    opts.signal,
  );
  const message = data.choices[0]?.message;
  if (!message?.content) throw new ProviderError(message?.refusal || "The model returned no content.", 502);
  return {
    value: JSON.parse(message.content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}
