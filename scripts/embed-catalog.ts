/**
 * One-off: embeds every catalog product and writes
 * src/data/catalog-embeddings.json plus a small src/data/embeddings-meta.json.
 *
 * Run with `npm run embed`. The provider is picked from AI_PROVIDER
 * ("openai" or "gemini"), or else from whichever key is set:
 * GEMINI_API_KEY (free tier is enough) or OPENAI_API_KEY.
 * Every mode of the app then uses the same provider, because query vectors
 * must come from the same model as the catalog vectors.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROVIDERS, type ProviderId } from "@/lib/config";
import { configureRetries, createEmbeddings } from "@/lib/llm";
import { catalogEmbeddingInputs } from "@/lib/pipeline";

function pickProvider(): ProviderId {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced) {
    if (forced !== "openai" && forced !== "gemini") throw new Error(`AI_PROVIDER must be "openai" or "gemini", got "${forced}".`);
    return forced;
  }
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY (for example in .env.local) before running this script.");
}

// Free-tier models are sometimes overloaded: be patient (up to ~1 minute per call).
configureRetries({ attempts: 6, baseDelayMs: 2000, onRetry: (info) => console.warn(`  retry: ${info}`) });

async function main() {
  const provider = pickProvider();
  const cfg = PROVIDERS[provider];
  const apiKey = process.env[cfg.envKey];
  if (!apiKey) throw new Error(`AI_PROVIDER is ${provider}, but ${cfg.envKey} is not set.`);

  const inputs = catalogEmbeddingInputs();
  console.log(`Embedding ${inputs.length} products with ${cfg.label} ${cfg.embeddingModel} (${cfg.dimensions} dims)...`);
  const { vectors } = await createEmbeddings(
    provider,
    apiKey,
    inputs.map((i) => i.text),
    "document",
  );

  const meta = {
    provider,
    model: cfg.embeddingModel,
    dimensions: cfg.dimensions,
    generatedAt: new Date().toISOString(),
  };
  const index = {
    ...meta,
    items: inputs.map((input, i) => ({
      sku: input.sku,
      // 6 decimals keeps the file small with no measurable effect on ranking.
      embedding: vectors[i].map((x) => Math.round(x * 1e6) / 1e6),
    })),
  };
  const dir = join(process.cwd(), "src/data");
  writeFileSync(join(dir, "catalog-embeddings.json"), JSON.stringify(index) + "\n");
  writeFileSync(join(dir, "embeddings-meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`Wrote src/data/catalog-embeddings.json and src/data/embeddings-meta.json (provider: ${provider}).`);
  console.log("Next: npm run precompute");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1; // not process.exit(): on Windows it can crash libuv while fetch sockets are closing
});
