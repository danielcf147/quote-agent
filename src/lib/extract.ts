import type { ExtractedItem } from "./types";

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_text", "search_query", "quantity", "unit", "unit_as_written"],
        properties: {
          source_text: {
            type: "string",
            description: "The exact substring of the request that mentions this item, copied verbatim.",
          },
          search_query: {
            type: "string",
            description:
              "A short English product description for catalog search: product type, material, size, volume, grade. No quantities, no brand guesses.",
          },
          quantity: { type: "number", description: "Requested amount as a number. Use 1 if not stated." },
          unit: {
            type: "string",
            enum: ["pack", "each", "L", "mL", "kg", "g"],
            description:
              "pack = a selling container (box, case, bottle, ream, roll, pack, bag). each = individual pieces. L/mL/kg/g = volume or mass.",
          },
          unit_as_written: {
            type: "string",
            description: "The unit word exactly as the customer wrote it, or an empty string if there is none.",
          },
        },
      },
    },
  },
} as const;

export function extractionSystemPrompt(maxItems: number): string {
  return [
    "You read free-text purchase requests for a laboratory and office supplies distributor.",
    "Return one entry per distinct product the customer wants to buy. Ignore greetings, signatures, delivery notes and anything that is not a product.",
    "The request may be in any language and may contain typos or informal names. search_query must always be in English and describe the product in neutral, specific terms (for example 'adjustable micropipette 100 microliter', not 'one of those pipettes').",
    "Keep sizes, volumes, grades and colors in search_query because they decide which variant matches.",
    "Words like 'a couple' mean 2, 'a few' mean 3, 'a dozen' means 12.",
    `Return at most ${maxItems} items. If there are more, keep the first ${maxItems}.`,
    "Never invent products that were not requested.",
  ].join("\n");
}

export type ExtractionResult = { items: ExtractedItem[] };
