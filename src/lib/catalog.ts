import catalogJson from "@/data/catalog.json";
import type { Product } from "./types";

export const catalog = catalogJson as Product[];

const bySku = new Map(catalog.map((p) => [p.sku, p]));

export function getProduct(sku: string): Product | undefined {
  return bySku.get(sku);
}

/** The exact text that gets embedded for each product. Shared by the script and the runtime. */
export function embeddingText(p: Product): string {
  return `${p.name}. ${p.description} Category: ${p.category}. Sold as: ${p.unit}.`;
}
