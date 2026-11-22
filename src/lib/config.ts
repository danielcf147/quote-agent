/**
 * Central knobs for the pipeline.
 *
 * Two providers are supported. The catalog embeddings decide which one is
 * active: query vectors must come from the same model as the catalog vectors,
 * so `npm run embed` records the provider and every mode follows it.
 */
export type ProviderId = "openai" | "gemini";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  chatModel: string;
  embeddingModel: string;
  dimensions: number;
  /** Env var read by the scripts and by live mode. */
  envKey: string;
  /** Host the browser talks to in bring-your-own-key mode. */
  host: string;
  keyUrl: string;
  keyPlaceholder: string;
  /** USD per 1M tokens at paid-tier rates, used only for the cost estimate in the trace. */
  pricing: { chatInput: number; chatOutput: number; embedding: number };
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    chatModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-small",
    dimensions: 512,
    envKey: "OPENAI_API_KEY",
    host: "api.openai.com",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    pricing: { chatInput: 0.4, chatOutput: 1.6, embedding: 0.02 },
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    chatModel: "gemini-2.5-flash",
    embeddingModel: "gemini-embedding-001",
    dimensions: 768,
    envKey: "GEMINI_API_KEY",
    host: "generativelanguage.googleapis.com",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    pricing: { chatInput: 0.3, chatOutput: 2.5, embedding: 0.15 },
  },
};

/**
 * Similarity thresholds per embedding model. Scores are not comparable across
 * models, so each provider has its own. `npm run precompute` prints every
 * score of the demo examples to re-calibrate them.
 */
export const THRESHOLDS: Record<ProviderId, { high: number; min: number; ambiguity: number }> = {
  openai: { high: 0.55, min: 0.4, ambiguity: 0.02 },
  gemini: { high: 0.7, min: 0.58, ambiguity: 0.015 },
};

export const TOP_K = 3;

export const LIMITS = {
  byok: { maxItems: 25, maxChars: 4000 },
  live: { maxItems: 8, maxChars: 800 },
} as const;

export const QUOTE_VALIDITY_DAYS = 30;
