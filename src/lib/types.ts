import type { ProviderId } from "./config";

export type Measure = "each" | "L" | "mL" | "kg" | "g";

export interface Product {
  sku: string;
  name: string;
  description: string;
  category: string;
  /** Selling unit label, e.g. "Box of 100" or "Bottle (1 L)". */
  unit: string;
  /** Price per selling unit, in USD. */
  price: number;
  /** What one selling unit contains. Used to convert "5 liters" into bottles. */
  content?: { amount: number; measure: "each" | "L" | "kg" };
}

export interface EmbeddingIndex {
  provider: ProviderId | null;
  model: string | null;
  dimensions: number;
  generatedAt: string | null;
  items: { sku: string; embedding: number[] }[];
}

/** Unit the customer used, as normalized by the extraction step. */
export type RequestedUnit = "pack" | "each" | "L" | "mL" | "kg" | "g";

export interface ExtractedItem {
  source_text: string;
  search_query: string;
  quantity: number;
  unit: RequestedUnit;
  /** The unit word as written, or an empty string. */
  unit_as_written: string;
}

export interface Candidate {
  sku: string;
  name: string;
  unit: string;
  price: number;
  score: number;
}

export type Confidence = "high" | "review" | "none";

export interface QuoteLine {
  index: number;
  sourceText: string;
  /** Character range of sourceText inside the original request, when found. */
  span: [number, number] | null;
  searchQuery: string;
  requested: { quantity: number; unit: RequestedUnit; unitAsWritten: string | null };
  match: Candidate | null;
  candidates: Candidate[];
  confidence: Confidence;
  /** Score gap between the best and second-best candidate. */
  margin: number;
  ambiguous: boolean;
  conversion: { packs: number; note: string | null };
  lineTotal: number;
  lexical: {
    /** Share of the customer's words that also appear in the matched product's name. */
    overlapWithMatch: number;
    /** What a plain keyword search would have picked. */
    keywordPick: { sku: string; name: string; score: number } | null;
  };
}

export interface StageTiming {
  id: "extract" | "embed" | "match" | "price";
  label: string;
  ms: number;
  detail: string;
}

export type RunMode = "demo" | "byok" | "live";

export interface QuoteResult {
  quoteNumber: string;
  createdAt: string;
  mode: RunMode;
  input: string;
  provider: ProviderId;
  models: { chat: string; embedding: string };
  thresholds: { high: number; min: number; ambiguity: number };
  lines: QuoteLine[];
  subtotal: number;
  currency: "USD";
  stages: StageTiming[];
  usage: { promptTokens: number; completionTokens: number; embeddingTokens: number };
  estimatedCostUsd: number;
  warnings: string[];
}

/** Small file written next to the embeddings so the UI knows the provider without loading the vectors. */
export interface EmbeddingMeta {
  provider: ProviderId | null;
  model: string | null;
  dimensions: number;
  generatedAt: string | null;
}

export interface DemoResultsFile {
  generatedAt: string | null;
  results: Record<string, QuoteResult>;
}
