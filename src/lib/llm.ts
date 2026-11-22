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
  ) {
    super(message);
  }
}

async function postJson<T>(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
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
    throw new ProviderError(message, res.status);
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
      // Extraction needs no deliberation; skipping Gemini's thinking step makes it faster and cheaper.
      ...(provider === "gemini" ? { reasoning_effort: "none" } : {}),
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
