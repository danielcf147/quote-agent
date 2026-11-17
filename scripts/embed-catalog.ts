/**
 * One-off: embeds every catalog product and writes src/data/catalog-embeddings.json.
 * Run with `npm run embed` (needs OPENAI_API_KEY in .env.local or the environment).
 * Cost for 80 products is a small fraction of a cent.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/lib/config";
import { createEmbeddings } from "@/lib/openai";
import { catalogEmbeddingInputs } from "@/lib/pipeline";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY (for example in .env.local) before running this script.");

  const inputs = catalogEmbeddingInputs();
  console.log(`Embedding ${inputs.length} products with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)...`);
  const { vectors, tokens } = await createEmbeddings(
    apiKey,
    EMBEDDING_MODEL,
    inputs.map((i) => i.text),
    EMBEDDING_DIMENSIONS,
  );

  const out = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    generatedAt: new Date().toISOString(),
    items: inputs.map((input, i) => ({
      sku: input.sku,
      // 6 decimals keeps the file small with no measurable effect on ranking.
      embedding: vectors[i].map((x) => Math.round(x * 1e6) / 1e6),
    })),
  };
  const file = join(process.cwd(), "src/data/catalog-embeddings.json");
  writeFileSync(file, JSON.stringify(out) + "\n");
  console.log(`Wrote ${file} (${tokens} tokens).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
