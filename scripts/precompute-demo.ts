/**
 * Runs the real pipeline once for each demo example and writes
 * src/data/demo-results.json, so demo mode never calls an API.
 * Run with `npm run precompute` after `npm run embed`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITS } from "@/lib/config";
import { EXAMPLES } from "@/lib/examples";
import { runQuotePipeline } from "@/lib/pipeline";
import type { DemoResultsFile, EmbeddingIndex } from "@/lib/types";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY (for example in .env.local) before running this script.");

  const index = JSON.parse(
    readFileSync(join(process.cwd(), "src/data/catalog-embeddings.json"), "utf8"),
  ) as EmbeddingIndex;

  const out: DemoResultsFile = { generatedAt: new Date().toISOString(), results: {} };
  let total = 0;
  for (const ex of EXAMPLES) {
    const result = await runQuotePipeline({
      input: ex.text,
      apiKey,
      index,
      mode: "demo",
      maxItems: LIMITS.byok.maxItems,
    });
    out.results[ex.id] = result;
    total += result.estimatedCostUsd;

    // Calibration table: use it to tune the thresholds in src/lib/config.ts.
    console.log(`\n${ex.title}  (${result.quoteNumber})`);
    for (const l of result.lines) {
      const [a, b] = l.candidates;
      console.log(
        `  ${l.confidence.padEnd(6)} ${a.score.toFixed(3)} (+${l.margin.toFixed(3)})  "${l.sourceText}"  ->  ${a.sku}` +
          (b ? `   [2nd ${b.sku} ${b.score.toFixed(3)}]` : ""),
      );
    }
  }

  const file = join(process.cwd(), "src/data/demo-results.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${file}. Estimated API cost: $${total.toFixed(5)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
