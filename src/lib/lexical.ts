/**
 * A deliberately naive keyword matcher. It is not used to pick products; it
 * runs next to the vector search so the trace can show what plain text
 * matching would have done with the same request.
 */
import type { Product } from "./types";

const STOPWORDS = new Set(
  "a an and of the for to with in on per by from or some those these that this any i we need please can you get also want would like about around".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9µ]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** Share of query words found in the text. */
export function overlap(query: string, text: string): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const t = new Set(tokenize(text));
  let hits = 0;
  for (const w of q) if (t.has(w)) hits++;
  return hits / q.size;
}

export function keywordSearch(query: string, products: Product[]) {
  let best: { product: Product; score: number } | null = null;
  for (const p of products) {
    const score = overlap(query, p.name);
    if (score > 0 && (!best || score > best.score)) best = { product: p, score };
  }
  return best;
}
