/**
 * Runs the real pipeline once for each demo example and writes
 * src/data/demo-results.json, so demo mode never calls an API.
 * Run with `npm run precompute` after `npm run embed`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITS, PROVIDERS } from "@/lib/config";
import { EXAMPLES } from "@/lib/examples";
import { configureChatModels, configureRetries, listGeminiFlashModels } from "@/lib/llm";
import { assertIndexReady, runQuotePipeline } from "@/lib/pipeline";
import type { DemoResultsFile, EmbeddingIndex } from "@/lib/types";

// Free-tier models are sometimes overloaded: be patient (up to ~1 minute per call).
configureRetries({ attempts: 4, baseDelayMs: 2000, timeoutMs: 60_000, onRetry: (info) => console.warn(`    retry: ${info}`) });

const STAGE_LOG = { extract: "extracting items", embed: "embedding queries", match: "searching catalog", verify: "verifying matches", price: "pricing" } as const;

async function main() {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), "src/data/catalog-embeddings.json"), "utf8"),
  ) as EmbeddingIndex;
  const cfg = PROVIDERS[assertIndexReady(index)];
  const apiKey = process.env[cfg.envKey];
  if (!apiKey) throw new Error(`The catalog was embedded with ${cfg.label}; set ${cfg.envKey} to precompute the demo.`);
  let models = cfg.chatModels;
  if (cfg.id === "gemini") {
    const available = await listGeminiFlashModels(apiKey);
    if (available.length) {
      models = available;
      configureChatModels("gemini", available);
    }
  }
  console.log(`Running the ${EXAMPLES.length} demo examples with ${cfg.label} + ${cfg.embeddingModel}.`);
  console.log(`Chat models, in fallback order: ${models.join(", ")}`);

  const out: DemoResultsFile = { generatedAt: new Date().toISOString(), results: {} };
  let total = 0;
  for (const [n, ex] of EXAMPLES.entries()) {
    console.log(`\n[${n + 1}/${EXAMPLES.length}] ${ex.title}`);
    const started = Date.now();
    const result = await runQuotePipeline({
      input: ex.text,
      apiKey,
      index,
      mode: "demo",
      maxItems: LIMITS.byok.maxItems,
      onStage: (stage) => console.log(`    ${STAGE_LOG[stage]}... (${((Date.now() - started) / 1000).toFixed(1)} s)`),
    });
    out.results[ex.id] = result;
    total += result.estimatedCostUsd;

    // Calibration table: use it to tune the thresholds in src/lib/config.ts.
    console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)} s with ${result.models.chat}, ${result.quoteNumber}:`);
    for (const l of result.lines) {
      const [a, b] = l.candidates;
      console.log(
        `  ${l.confidence.padEnd(6)} ${a.score.toFixed(3)} (+${l.margin.toFixed(3)})  "${l.sourceText}"  ->  ${a.sku}` +
          (b ? `   [2nd ${b.sku} ${b.score.toFixed(3)}]` : "") +
          `   check: ${l.verification?.fit ?? "-"} -> ${l.match?.sku ?? "NOT QUOTED"}${l.reranked ? " (reranked)" : ""}`,
      );
    }
  }

  const file = join(process.cwd(), "src/data/demo-results.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${file}. Estimated cost at paid-tier rates: $${total.toFixed(5)}`);
  console.log("Columns: decision, top score (+gap to runner-up), customer text -> best SKU. Thresholds live in src/lib/config.ts.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1; // not process.exit(): on Windows it can crash libuv while fetch sockets are closing
});
