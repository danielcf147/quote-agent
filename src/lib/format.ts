const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const money = (n: number) => usd.format(n);

export const score = (n: number) => n.toFixed(3);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function hue(index: number): string {
  return `var(--h${index % 6})`;
}

export function formatDate(iso: string, addDays = 0): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatCost(usdAmount: number): string {
  if (usdAmount === 0) return "$0";
  if (usdAmount < 0.01) return `$${usdAmount.toFixed(5)}`;
  return money(usdAmount);
}
