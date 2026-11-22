import meta from "@/data/embeddings-meta.json";
import { PROVIDERS, type ProviderConfig } from "./config";
import type { EmbeddingMeta } from "./types";

const provider = (meta as EmbeddingMeta).provider;

/** The provider the catalog was embedded with, or null before `npm run embed` has run. */
export const activeProvider: ProviderConfig | null = provider ? PROVIDERS[provider] : null;

/** For copy on the page: the active provider, or Gemini (the default for new setups). */
export const displayProvider: ProviderConfig = activeProvider ?? PROVIDERS.gemini;
