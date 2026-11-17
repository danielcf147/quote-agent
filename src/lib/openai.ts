/**
 * Minimal OpenAI client over fetch. It has no Node dependencies, so the same
 * code runs in the browser (bring-your-own-key), in the API route (live mode)
 * and in the build scripts.
 */
const BASE_URL = "https://api.openai.com/v1";

export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function post<T>(apiKey: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = `OpenAI request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
    } catch {
      // keep the generic message
    }
    throw new OpenAIError(message, res.status);
  }
  return (await res.json()) as T;
}

export async function createEmbeddings(
  apiKey: string,
  model: string,
  input: string[],
  dimensions: number,
  signal?: AbortSignal,
) {
  const data = await post<{
    data: { index: number; embedding: number[] }[];
    usage: { prompt_tokens: number; total_tokens: number };
  }>(apiKey, "/embeddings", { model, input, dimensions, encoding_format: "float" }, signal);
  const vectors = data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return { vectors, tokens: data.usage.total_tokens };
}

export async function createStructuredCompletion<T>(
  apiKey: string,
  opts: {
    model: string;
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    signal?: AbortSignal;
  },
) {
  const data = await post<{
    choices: { message: { content: string | null; refusal?: string | null } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  }>(
    apiKey,
    "/chat/completions",
    {
      model: opts.model,
      temperature: 0,
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
  if (!message?.content) throw new OpenAIError(message?.refusal || "The model returned no content.", 502);
  return {
    value: JSON.parse(message.content) as T,
    promptTokens: data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
  };
}
