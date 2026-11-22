import type { CSSProperties } from "react";
import { formatCost, hue, pct, score } from "@/lib/format";
import type { QuoteLine, QuoteResult } from "@/lib/types";

type Thresholds = QuoteResult["thresholds"];

interface Props {
  result: QuoteResult;
  active: number | null;
  onHover: (index: number | null) => void;
}

export function ReasoningPanel({ result, active, onHover }: Props) {
  const totalMs = result.stages.reduce((s, st) => s + st.ms, 0);
  const tokens = result.usage.promptTokens + result.usage.completionTokens + result.usage.embeddingTokens;

  return (
    <section aria-label="How the quote was built" className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Pipeline</h3>
          <p className="text-xs text-ink-3 tabular">
            {(totalMs / 1000).toFixed(2)} s · {tokens.toLocaleString("en-US")} tokens · {formatCost(result.estimatedCostUsd)}
          </p>
        </div>
        <ol className="mt-3 divide-y divide-line overflow-hidden rounded-lg bg-surface-2">
          {result.stages.map((st, i) => (
            <li key={st.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-x-2 px-3 py-2 text-xs">
              <span className="font-mono text-ink-3">{i + 1}</span>
              <span className="min-w-0">
                <span className="font-medium text-ink">{st.label}</span>
                <span className="ml-2 text-[11px] text-ink-3">{st.detail}</span>
              </span>
              <span className="font-mono text-ink-3 tabular">{st.ms} ms</span>
            </li>
          ))}
        </ol>
        {result.warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {result.warnings.map((w) => (
              <li key={w} className="flex gap-2 text-xs text-warn">
                <span aria-hidden>▲</span>
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ol className="space-y-3">
        {result.lines.map((l, i) => (
          <li key={l.index} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <LineTrace line={l} th={result.thresholds} active={active === l.index} onHover={onHover} />
          </li>
        ))}
      </ol>
    </section>
  );
}

const VERDICT = {
  high: { label: "Matched", cls: "bg-good-soft text-good" },
  review: { label: "Needs review", cls: "bg-warn-soft text-warn" },
  none: { label: "Not quoted", cls: "bg-bad-soft text-bad" },
} as const;

function decisionText(l: QuoteLine, th: Thresholds): string {
  const top = l.candidates[0].score;
  const v = l.verification;
  if (top < th.min)
    return `Best similarity ${score(top)} < ${th.min.toFixed(2)}: nothing in the catalog is close enough, so the item was left out instead of guessing.`;
  if (!l.match) return "The verifier found that none of the nearest products is what was asked for, so the item was left out instead of quoting something merely related.";
  const s = score(l.match.score);
  const picked = l.reranked ? "The verifier picked a lower-ranked candidate whose specs fit better. " : "";
  if (l.confidence === "high") return `${picked}Exact fit and similarity ${s} ≥ ${th.high.toFixed(2)}: accepted.`;
  if (v?.fit === "partial") return `${picked}Same kind of product, but a spec is unstated or uncertain: quoted and flagged for a human to confirm.`;
  return `${picked}Similarity ${s} is below ${th.high.toFixed(2)}: quoted, but flagged for a human to confirm.`;
}

const FIT_LABEL = { exact: "Exact fit", partial: "Partial fit", none: "No fit" } as const;

function unitText(l: QuoteLine): string {
  const { quantity, unit, unitAsWritten } = l.requested;
  const written = unitAsWritten ? ` “${unitAsWritten}”` : "";
  const normalized = unit === "pack" ? "selling unit" : unit === "each" ? "pieces" : unit;
  return `${quantity}${written} → ${normalized}`;
}

function LineTrace({
  line: l,
  th,
  active,
  onHover,
}: {
  line: QuoteLine;
  th: Thresholds;
  active: boolean;
  onHover: (index: number | null) => void;
}) {
  const verdict = VERDICT[l.confidence];
  const kw = l.lexical.keywordPick;
  const kwAgrees = kw && l.match && kw.sku === l.match.sku;

  return (
    <article
      onMouseEnter={() => onHover(l.index)}
      onMouseLeave={() => onHover(null)}
      className="rounded-xl border bg-surface transition-[border-color,box-shadow] duration-150"
      style={
        {
          borderColor: active ? hue(l.index) : "var(--line)",
          boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${hue(l.index)} 15%, transparent)` : undefined,
        } as CSSProperties
      }
    >
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-white"
          style={{ background: hue(l.index) }}
        >
          {l.index + 1}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink">&ldquo;{l.sourceText}&rdquo;</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${verdict.cls}`}>
          {verdict.label}
        </span>
      </header>

      <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-3 text-xs sm:grid-cols-[112px_minmax(0,1fr)]">
        <dt className="pt-0.5 text-ink-3">Understood as</dt>
        <dd className="text-ink-2">
          <span className="break-words font-mono text-ink">{l.searchQuery}</span>
          <span className="mt-1 block text-ink-3">{unitText(l)}</span>
        </dd>

        <dt className="pt-0.5 text-ink-3">Nearest products</dt>
        <dd>
          <ul className="space-y-2">
            {l.candidates.map((c, rank) => (
              <li key={c.sku}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`min-w-0 truncate ${c.sku === l.match?.sku ? "font-medium text-ink" : "text-ink-2"}`}
                    title={c.name}
                  >
                    {c.sku === l.match?.sku ? "✓ " : ""}
                    {c.name}
                  </span>
                  <span className={`font-mono tabular ${rank === 0 ? "text-ink" : "text-ink-3"}`}>{score(c.score)}</span>
                </div>
                <ScoreBar
                  value={c.score}
                  th={th}
                  color={c.sku === l.match?.sku || (!l.match && rank === 0) ? hue(l.index) : "var(--line-strong)"}
                />
              </li>
            ))}
          </ul>
        </dd>

        {l.verification && (
          <>
            <dt className="pt-0.5 text-ink-3">LLM check</dt>
            <dd className="leading-relaxed text-ink-2">
              <span
                className={`mr-1.5 font-medium ${
                  l.verification.fit === "exact" ? "text-good" : l.verification.fit === "partial" ? "text-warn" : "text-bad"
                }`}
              >
                {FIT_LABEL[l.verification.fit]}.
              </span>
              {l.verification.reason}
              {l.ambiguous && (
                <span className="mt-1 block text-ink-3">
                  Similarity alone could not separate the top two ({score(l.margin)} apart).
                </span>
              )}
            </dd>
          </>
        )}

        <dt className="pt-0.5 text-ink-3">Decision</dt>
        <dd className="leading-relaxed text-ink-2">{decisionText(l, th)}</dd>

        {l.match && (
          <>
            <dt className="pt-0.5 text-ink-3">Quantity</dt>
            <dd className="text-ink-2">
              {l.conversion.note ?? `${l.conversion.packs} × ${l.match.unit}`}
            </dd>
          </>
        )}

        <dt className="pt-0.5 text-ink-3">Keyword search</dt>
        <dd className="leading-relaxed text-ink-2">
          {kw ? (
            kwAgrees ? (
              <>Would also have found this one ({pct(kw.score)} word overlap).</>
            ) : (
              <>
                Would have picked <span className="text-ink">{kw.name}</span>{" "}
                <span className="text-ink-3">({pct(kw.score)} word overlap)</span>
                {l.match ? ", a different product than the vector search chose." : "."}
              </>
            )
          ) : (
            <>Found nothing: none of the customer&rsquo;s words appear in any product name.</>
          )}
        </dd>
      </dl>
    </article>
  );
}

/**
 * Similarity bar with ticks at the two decision thresholds. The scale starts a
 * little below the minimum threshold so differences in the relevant range are visible.
 */
function ScoreBar({ value, color, th }: { value: number; color: string; th: Thresholds }) {
  const lo = Math.max(0, th.min - 0.3);
  const pos = (v: number) => Math.max(0, Math.min(1, (v - lo) / (1 - lo))) * 100;
  const w = pos(value);
  return (
    <div className="relative mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: color }} />
      <div className="absolute -inset-y-0.5 w-px bg-ink-3/50" style={{ left: `${pos(th.min)}%` }} />
      <div className="absolute -inset-y-0.5 w-px bg-ink-3/50" style={{ left: `${pos(th.high)}%` }} />
    </div>
  );
}
