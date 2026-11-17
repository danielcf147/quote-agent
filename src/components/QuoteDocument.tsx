import { QUOTE_VALIDITY_DAYS } from "@/lib/config";
import { formatDate, hue, money } from "@/lib/format";
import type { QuoteResult } from "@/lib/types";

interface Props {
  result: QuoteResult;
  active: number | null;
  onHover: (index: number | null) => void;
}

const MODE_LABEL = { demo: "Precomputed demo", byok: "Your key", live: "Live" } as const;

export function QuoteDocument({ result, active, onHover }: Props) {
  const quoted = result.lines.filter((l) => l.match);
  const notQuoted = result.lines.filter((l) => !l.match);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Quotation</p>
          <p className="mt-1 font-mono text-lg font-medium text-ink">{result.quoteNumber}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <dt className="text-ink-3">Issued</dt>
          <dd className="text-right text-ink-2 tabular">{formatDate(result.createdAt)}</dd>
          <dt className="text-ink-3">Valid until</dt>
          <dd className="text-right text-ink-2 tabular">{formatDate(result.createdAt, QUOTE_VALIDITY_DAYS)}</dd>
          <dt className="text-ink-3">Source</dt>
          <dd className="text-right text-ink-2">{MODE_LABEL[result.mode]}</dd>
        </dl>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
              <th className="w-10 py-2.5 pl-5 font-medium sm:pl-6">#</th>
              <th className="py-2.5 pr-3 font-medium">Item</th>
              <th className="py-2.5 pr-3 text-right font-medium">Qty</th>
              <th className="py-2.5 pr-3 text-right font-medium">Unit price</th>
              <th className="py-2.5 pr-5 text-right font-medium sm:pr-6">Total</th>
            </tr>
          </thead>
          <tbody>
            {quoted.map((l) => (
              <tr
                key={l.index}
                onMouseEnter={() => onHover(l.index)}
                onMouseLeave={() => onHover(null)}
                className={`border-b border-line/70 align-top transition-colors last:border-0 ${
                  active === l.index ? "bg-surface-2" : ""
                }`}
              >
                <td className="py-3 pl-5 sm:pl-6">
                  <span
                    className="inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-white"
                    style={{ background: hue(l.index) }}
                  >
                    {l.index + 1}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <p className="leading-snug text-ink">{l.match!.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <span className="font-mono">{l.match!.sku}</span>
                    <span>·</span>
                    <span>{l.match!.unit}</span>
                    {(l.confidence === "review" || l.ambiguous) && (
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
                        Review
                      </span>
                    )}
                  </p>
                </td>
                <td className="py-3 pr-3 text-right text-ink tabular">{l.conversion.packs}</td>
                <td className="py-3 pr-3 text-right text-ink-2 tabular">{money(l.match!.price)}</td>
                <td className="py-3 pr-5 text-right font-medium text-ink tabular sm:pr-6">{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notQuoted.length > 0 && (
        <div className="border-t border-line bg-bad-soft/40 px-5 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-bad">Not quoted</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {notQuoted.map((l) => (
              <li
                key={l.index}
                className="flex gap-2 text-ink-2"
                onMouseEnter={() => onHover(l.index)}
                onMouseLeave={() => onHover(null)}
              >
                <span className="font-mono text-xs" style={{ color: hue(l.index) }}>
                  {l.index + 1}
                </span>
                <span>
                  &ldquo;{l.sourceText}&rdquo; <span className="text-ink-3">no confident match in the catalog</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex items-end justify-between gap-4 border-t border-line bg-surface-2/60 px-5 py-4 sm:px-6">
        <p className="max-w-xs text-xs leading-relaxed text-ink-3">
          Fictional catalog and prices. Taxes and shipping not included.
        </p>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Subtotal ({result.currency})</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink tabular">{money(result.subtotal)}</p>
        </div>
      </footer>
    </article>
  );
}
