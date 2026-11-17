import type { Product, RequestedUnit } from "./types";

const TO_BASE: Record<string, { measure: "L" | "kg" | "each"; factor: number }> = {
  L: { measure: "L", factor: 1 },
  mL: { measure: "L", factor: 0.001 },
  kg: { measure: "kg", factor: 1 },
  g: { measure: "kg", factor: 0.001 },
  each: { measure: "each", factor: 1 },
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Turns "5 L" or "200 tips" into a whole number of selling units for the
 * matched product, always rounding up, and explains what it did.
 */
export function toSellingUnits(
  quantity: number,
  unit: RequestedUnit,
  product: Product,
): { packs: number; note: string | null } {
  const qty = quantity > 0 ? quantity : 1;
  if (unit === "pack") return { packs: Math.ceil(qty), note: null };

  const content = product.content;
  const base = TO_BASE[unit];
  if (!content || !base) return { packs: Math.ceil(qty), note: null };

  if (content.measure !== base.measure) {
    return {
      packs: Math.ceil(qty),
      note: `Requested in ${unit}, but this product is sold by ${product.unit.toLowerCase()}; quantity taken as selling units.`,
    };
  }

  const contentInBase = content.amount;
  const requestedInBase = qty * base.factor;
  if (content.measure === "each" && contentInBase === 1) return { packs: Math.ceil(qty), note: null };

  const exact = requestedInBase / contentInBase;
  const packs = Math.max(1, Math.ceil(exact - 1e-9));
  const delivered = packs * contentInBase;
  const shownUnit = content.measure === "each" ? "units" : content.measure;
  const asked = `${fmt(qty)} ${unit === "each" ? "units" : unit}`;
  const note =
    Math.abs(exact - packs) < 1e-9
      ? `${asked} = ${packs} × ${product.unit}.`
      : `${asked} rounded up to ${packs} × ${product.unit} (${fmt(delivered)} ${shownUnit}).`;
  return { packs, note };
}
