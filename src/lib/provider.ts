import demoFile from "@/data/demo-results.json";
import meta from "@/data/embeddings-meta.json";
import { PROVIDERS, type ProviderConfig } from "./config";
import type { DemoResultsFile, EmbeddingMeta } from "./types";

const provider = (meta as EmbeddingMeta).provider;

/** The provider the catalog was embedded with, or null before `npm run embed` has run. */
export const activeProvider: ProviderConfig | null = provider ? PROVIDERS[provider] : null;

/** For copy on the page: the active provider, or Gemini (the default for new setups). */
export const displayProvider: ProviderConfig = activeProvider ?? PROVIDERS.gemini;

/**
 * Chat model(s) that actually produced the demo results, read from the same
 * field the trace shows. The fallback list can pick a different model than the
 * first choice, so the page copy must not hard-code one. Falls back to the
 * configured first choice before `npm run precompute` has run.
 */
const demoModels = [
  ...new Set(Object.values((demoFile as unknown as DemoResultsFile).results).map((r) => r.models.chat)),
];
export const demoChatModels: string[] = demoModels.length ? demoModels : [displayProvider.chatModel];
