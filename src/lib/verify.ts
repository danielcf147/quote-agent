/**
 * Verification step: an LLM reviews the top vector-search candidates for every
 * line item in one call.
 *
 * Similarity alone cannot tell "a centrifuge" from "centrifuge tubes", or a
 * 10–100 µL pipette from a 100–1000 µL one: both pairs sit close together in
 * embedding space. The verifier reads the specs and either confirms a
 * candidate, picks a better one among the top results, or rejects them all.
 */
import { getProduct } from "./catalog";
import type { ExtractedItem } from "./types";

export type Fit = "exact" | "partial" | "none";

export interface VerifierVerdict {
  index: number;
  choice: string;
  fit: Fit;
  reason: string;
}

export const VERIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "choice", "fit", "reason"],
        properties: {
          index: { type: "integer", description: "The item number given in the input." },
          choice: { type: "string", description: "SKU of the chosen candidate, or NONE." },
          fit: {
            type: "string",
            enum: ["exact", "partial", "none"],
            description:
              "exact = same kind of product and every stated spec is met. partial = same kind of product but a spec is unstated, guessed or slightly off. none = no candidate is the kind of product requested.",
          },
          reason: { type: "string", description: "One short sentence, at most 20 words." },
        },
      },
    },
  },
} as const;

export const VERIFICATION_SYSTEM_PROMPT = [
  "You check catalog matches for a laboratory and office supplies distributor.",
  "For each requested item you get the customer's words and up to three catalog candidates found by semantic search.",
  "Choose the candidate that is the same kind of product and best satisfies the stated specs (size, range, concentration, grade, color).",
  "Ignore the requested quantity and the pack or bottle size: '5 liters' of a solvent sold in 1 L or 4 L bottles, or '200 pieces' of an item sold in sleeves of 20, is an exact fit. Quantities are converted to packs in a later step.",
  "Catalog names are formal: chemical names (2-propanol = isopropyl alcohol = IPA), generic names instead of brands (thermoplastic sealing film = Parafilm), technical wording. Judge by meaning, not wording.",
  "For ranges, prefer the instrument whose range is designed for the requested value (a '100 µL pipette' is a 10–100 µL model, not 100–1000 µL).",
  "A consumable or accessory is not the device itself: tubes are not a centrifuge, tips are not a pipette.",
  "If no candidate is the requested kind of product, answer choice NONE with fit none. Do not settle for something merely related.",
  "When the customer leaves a spec open (no size, no grade) and the candidates differ only in that spec, pick the most common one with fit partial.",
  "Use only the given SKUs.",
].join("\n");

export function verificationUserPrompt(
  items: ExtractedItem[],
  candidates: { sku: string; score: number }[][],
): string {
  return items
    .map((item, i) => {
      const lines = candidates[i].map((c) => {
        const p = getProduct(c.sku)!;
        return `  - ${p.sku}: ${p.name}. ${p.description} Sold as ${p.unit}.`;
      });
      return `Item ${i}: "${item.source_text}" (interpreted as: ${item.search_query})\nCandidates:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
