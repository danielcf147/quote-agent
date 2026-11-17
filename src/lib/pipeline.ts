import { catalog, embeddingText, getProduct } from "./catalog";
import {
  AMBIGUITY_MARGIN,
  CHAT_MODEL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  HIGH_CONFIDENCE,
  MIN_SIMILARITY,
  PRICING,
  TOP_K,
} from "./config";
import { EXTRACTION_SCHEMA, extractionSystemPrompt, type ExtractionResult } from "./extract";
import { keywordSearch, overlap } from "./lexical";
import { createEmbeddings, createStructuredCompletion } from "./openai";
import type {
  Candidate,
  Confidence,
  EmbeddingIndex,
  Product,
  QuoteLine,
  QuoteResult,
  RunMode,
  StageTiming,
} from "./types";
import { toSellingUnits } from "./units";
import { cosineSimilarity, topK } from "./vector";

export class PipelineError extends Error {}

export interface PipelineOptions {
  input: string;
  apiKey: string;
  index: EmbeddingIndex;
  mode: RunMode;
  maxItems: number;
  signal?: AbortSignal;
  /** Called when a stage starts, so a UI can show progress. */
  onStage?: (stage: StageTiming["id"]) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function findSpan(input: string, fragment: string): [number, number] | null {
  if (!fragment) return null;
  const i = input.toLowerCase().indexOf(fragment.toLowerCase());
  return i >= 0 ? [i, i + fragment.length] : null;
}

function quoteNumber(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, "0");
  return `Q-${ymd}-${rand}`;
}

function toCandidate(p: Product, score: number): Candidate {
  return { sku: p.sku, name: p.name, unit: p.unit, price: p.price, score: round4(score) };
}

export function assertIndexReady(index: EmbeddingIndex) {
  if (!index.items.length || !index.model) {
    throw new PipelineError("Catalog embeddings have not been generated yet. Run `npm run embed` first.");
  }
  if (index.model !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new PipelineError(
      `Catalog embeddings were built with ${index.model}/${index.dimensions}, but the app queries with ${EMBEDDING_MODEL}/${EMBEDDING_DIMENSIONS}. Re-run \`npm run embed\`.`,
    );
  }
}

/** Free text in, priced quote plus a full trace of how each line was decided out. */
export async function runQuotePipeline(opts: PipelineOptions): Promise<QuoteResult> {
  const { input, apiKey, index, mode, maxItems, signal, onStage } = opts;
  assertIndexReady(index);
  const stages: StageTiming[] = [];
  const warnings: string[] = [];

  // 1. Extract structured line items with an LLM.
  onStage?.("extract");
  let t = now();
  const extraction = await createStructuredCompletion<ExtractionResult>(apiKey, {
    model: CHAT_MODEL,
    system: extractionSystemPrompt(maxItems),
    user: input,
    schemaName: "purchase_request",
    schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
    signal,
  });
  let items = extraction.value.items.filter((i) => i.search_query.trim());
  if (items.length > maxItems) {
    warnings.push(`Only the first ${maxItems} items were processed (limit for this mode).`);
    items = items.slice(0, maxItems);
  }
  stages.push({
    id: "extract",
    label: "Extract line items",
    ms: Math.round(now() - t),
    detail: `${CHAT_MODEL} · structured output · ${items.length} item${items.length === 1 ? "" : "s"} found`,
  });
  if (items.length === 0) throw new PipelineError("No products were found in that request.");

  // 2. Embed every search query in one batched call.
  onStage?.("embed");
  t = now();
  const embedded = await createEmbeddings(
    apiKey,
    EMBEDDING_MODEL,
    items.map((i) => i.search_query),
    EMBEDDING_DIMENSIONS,
    signal,
  );
  stages.push({
    id: "embed",
    label: "Embed search queries",
    ms: Math.round(now() - t),
    detail: `${EMBEDDING_MODEL} · ${EMBEDDING_DIMENSIONS} dimensions · 1 batched call`,
  });

  // 3. Cosine similarity against the precomputed catalog vectors, in memory.
  onStage?.("match");
  t = now();
  const vectors = index.items
    .map((it) => ({ product: getProduct(it.sku), embedding: it.embedding }))
    .filter((v): v is { product: Product; embedding: number[] } => !!v.product);

  const matched = items.map((item, i) => {
    const ranked = topK(vectors, (v) => cosineSimilarity(embedded.vectors[i], v.embedding), TOP_K);
    return { item, ranked };
  });
  stages.push({
    id: "match",
    label: "Vector search",
    ms: Math.max(1, Math.round(now() - t)),
    detail: `cosine similarity · ${items.length} × ${vectors.length} comparisons · top ${TOP_K} kept`,
  });

  // 4. Decide, convert units and price.
  onStage?.("price");
  t = now();
  const lines: QuoteLine[] = matched.map(({ item, ranked }, i) => {
    const candidates = ranked.map((r) => toCandidate(r.item.product, r.score));
    const best = ranked[0];
    const margin = ranked.length > 1 ? round4(ranked[0].score - ranked[1].score) : 1;
    const confidence: Confidence =
      best.score >= HIGH_CONFIDENCE ? "high" : best.score >= MIN_SIMILARITY ? "review" : "none";
    const product = confidence === "none" ? null : best.item.product;
    const conversion = product
      ? toSellingUnits(item.quantity, item.unit, product)
      : { packs: 0, note: null };
    const keywordPick = keywordSearch(item.source_text, catalog);
    return {
      index: i,
      sourceText: item.source_text,
      span: findSpan(input, item.source_text),
      searchQuery: item.search_query,
      requested: { quantity: item.quantity, unit: item.unit, unitAsWritten: item.unit_as_written },
      match: product ? candidates[0] : null,
      candidates,
      confidence,
      margin,
      ambiguous: confidence !== "none" && margin < AMBIGUITY_MARGIN,
      conversion,
      lineTotal: product ? round2(conversion.packs * product.price) : 0,
      lexical: {
        overlapWithMatch: round4(overlap(item.source_text, best.item.product.name)),
        keywordPick: keywordPick
          ? { sku: keywordPick.product.sku, name: keywordPick.product.name, score: round4(keywordPick.score) }
          : null,
      },
    };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const unmatched = lines.filter((l) => l.confidence === "none").length;
  const review = lines.filter((l) => l.confidence === "review" || l.ambiguous).length;
  if (unmatched) warnings.push(`${unmatched} item${unmatched > 1 ? "s" : ""} had no confident catalog match and ${unmatched > 1 ? "were" : "was"} left out of the total.`);
  if (review) warnings.push(`${review} line${review > 1 ? "s" : ""} flagged for human review.`);
  stages.push({
    id: "price",
    label: "Convert units & price",
    ms: Math.max(1, Math.round(now() - t)),
    detail: `${lines.length - unmatched} priced · ${unmatched} unmatched · ${review} flagged`,
  });

  const usage = {
    promptTokens: extraction.promptTokens,
    completionTokens: extraction.completionTokens,
    embeddingTokens: embedded.tokens,
  };
  const estimatedCostUsd =
    (usage.promptTokens * PRICING.chatInput +
      usage.completionTokens * PRICING.chatOutput +
      usage.embeddingTokens * PRICING.embedding) /
    1_000_000;

  return {
    quoteNumber: quoteNumber(),
    createdAt: new Date().toISOString(),
    mode,
    input,
    models: { chat: CHAT_MODEL, embedding: EMBEDDING_MODEL },
    lines,
    subtotal,
    currency: "USD",
    stages,
    usage,
    estimatedCostUsd,
    warnings,
  };
}

/** Used by the embedding script so runtime and build share the exact same text. */
export function catalogEmbeddingInputs() {
  return catalog.map((p) => ({ sku: p.sku, text: embeddingText(p) }));
}
