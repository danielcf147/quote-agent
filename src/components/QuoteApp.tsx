"use client";

import { useEffect, useRef, useState } from "react";
import demoFile from "@/data/demo-results.json";
import { LIMITS } from "@/lib/config";
import { EXAMPLES } from "@/lib/examples";
import type { DemoResultsFile, QuoteResult, RunMode, StageTiming } from "@/lib/types";
import { HighlightedRequest } from "./HighlightedRequest";
import { KeyField, readStoredKey, useStoredKey } from "./KeyField";
import { QuoteDocument } from "./QuoteDocument";
import { ReasoningPanel } from "./ReasoningPanel";

const demo = demoFile as unknown as DemoResultsFile;
const demoReady = Object.keys(demo.results).length > 0;

type LiveStatus = { enabled: false } | { enabled: true; maxItems: number; maxChars: number; perWindow: number; windowMinutes: number };

const STAGE_LABEL: Record<StageTiming["id"], string> = {
  extract: "Reading the request",
  embed: "Embedding search queries",
  match: "Searching the catalog",
  price: "Pricing the quote",
};

export function QuoteApp() {
  const [mode, setMode] = useState<RunMode>("demo");
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [text, setText] = useState(EXAMPLES[0].text);
  const [result, setResult] = useState<QuoteResult | null>(demoReady ? demo.results[EXAMPLES[0].id] ?? null : null);
  const [stage, setStage] = useState<StageTiming["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const hasKey = !!useStoredKey();
  const [live, setLive] = useState<LiveStatus>({ enabled: false });
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setLive(d.live))
      .catch(() => {});
  }, []);

  const busy = stage !== null;
  const limits = mode === "live" ? LIMITS.live : LIMITS.byok;

  function pickExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    setExampleId(id);
    setText(ex.text);
    setError(null);
    if (mode === "demo") setResult(demo.results[id] ?? null);
  }

  function switchMode(next: RunMode) {
    abortRef.current?.abort();
    setStage(null);
    setMode(next);
    setError(null);
    if (next === "demo") {
      const ex = EXAMPLES.find((e) => e.id === exampleId) ?? EXAMPLES[0];
      setText(ex.text);
      setResult(demo.results[ex.id] ?? null);
    }
  }

  async function run() {
    setError(null);
    const input = text.trim();
    if (!input) return setError("Write a purchase request first.");
    if (input.length > limits.maxChars) return setError(`This mode accepts up to ${limits.maxChars} characters.`);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let next: QuoteResult;
      if (mode === "byok") {
        const apiKey = readStoredKey();
        if (!apiKey) throw new Error("Add your OpenAI API key first.");
        setStage("extract");
        // Loaded on demand so demo visitors never download the vectors.
        const [{ runQuotePipeline }, embeddings] = await Promise.all([
          import("@/lib/pipeline"),
          import("@/data/catalog-embeddings.json"),
        ]);
        next = await runQuotePipeline({
          input,
          apiKey,
          index: embeddings.default as never,
          mode: "byok",
          maxItems: LIMITS.byok.maxItems,
          signal: controller.signal,
          onStage: setStage,
        });
      } else {
        setStage("extract");
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed.");
        next = data;
      }
      setResult(next);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (abortRef.current === controller) setStage(null);
    }
  }

  const editable = mode !== "demo";

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <ModeSwitch mode={mode} onChange={switchMode} live={live.enabled} />

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((ex) => {
            const selected = mode === "demo" ? ex.id === exampleId : false;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => pickExample(ex.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-surface-2"
                }`}
              >
                <span className="block text-sm font-medium text-ink">{ex.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-3">{ex.blurb}</span>
              </button>
            );
          })}
        </div>

        {mode === "byok" && (
          <div className="mt-5">
            <KeyField />
          </div>
        )}

        <label htmlFor="request" className="mt-5 block text-xs font-medium text-ink-2">
          Purchase request
          {!editable && <span className="font-normal text-ink-3"> · read-only in demo mode, switch modes to write your own</span>}
        </label>
        <textarea
          id="request"
          value={text}
          readOnly={!editable}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={limits.maxChars}
          placeholder="e.g. need 10 boxes of medium nitrile gloves and 5 L of IPA"
          className={`mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none transition-shadow placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent/15 ${
            !editable ? "cursor-default text-ink-2" : ""
          }`}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            {mode === "demo" && "Results were produced by the real pipeline and saved, so this mode makes no API calls."}
            {mode === "byok" && `Up to ${LIMITS.byok.maxItems} items · ${text.length}/${LIMITS.byok.maxChars} characters`}
            {mode === "live" && live.enabled &&
              `Up to ${live.maxItems} items · ${live.perWindow} requests per ${live.windowMinutes} min · ${text.length}/${live.maxChars} characters`}
          </p>
          {editable && (
            <button
              type="button"
              onClick={run}
              disabled={busy || (mode === "byok" && !hasKey)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {STAGE_LABEL[stage!]}…
                </>
              ) : (
                "Generate quote"
              )}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
      </section>

      <div ref={resultsRef} className="scroll-mt-6">
        {!result && mode === "demo" && !demoReady && <SetupNotice />}
        {result && (
          <div key={result.quoteNumber} className="mt-8 space-y-6">
            <section className="rise rounded-2xl border border-line bg-surface px-4 py-4 sm:px-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">What the agent read</h2>
              <div className="mt-2">
                <HighlightedRequest text={result.input} lines={result.lines} active={active} onHover={setActive} />
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="rise space-y-3 lg:sticky lg:top-6">
                <h2 className="text-sm font-semibold text-ink">Quote</h2>
                <QuoteDocument result={result} active={active} onHover={setActive} />
              </div>
              <div className="rise space-y-3" style={{ animationDelay: "80ms" }}>
                <h2 className="text-sm font-semibold text-ink">
                  How it got there <span className="font-normal text-ink-3">· hover a line to trace it</span>
                </h2>
                <ReasoningPanel result={result} active={active} onHover={setActive} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ModeSwitch({ mode, onChange, live }: { mode: RunMode; onChange: (m: RunMode) => void; live: boolean }) {
  const options: { id: RunMode; label: string; hint: string; disabled?: boolean }[] = [
    { id: "demo", label: "Demo", hint: "Precomputed, no key needed" },
    { id: "byok", label: "Your OpenAI key", hint: "Try your own text" },
    { id: "live", label: "Live", hint: live ? "Hosted key, rate-limited" : "Not enabled here", disabled: !live },
  ];
  return (
    <div role="tablist" aria-label="Run mode" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          type="button"
          aria-selected={mode === o.id}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 ${
            mode === o.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          <span className="block text-sm font-medium">{o.label}</span>
          <span className="hidden text-[11px] text-ink-3 sm:block">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-sm leading-relaxed text-ink-2">
      <p className="font-medium text-ink">Demo results have not been generated yet.</p>
      <p className="mt-2">
        Add <code className="rounded bg-surface-2 px-1 font-mono text-xs">OPENAI_API_KEY</code> to{" "}
        <code className="rounded bg-surface-2 px-1 font-mono text-xs">.env.local</code>, then run{" "}
        <code className="rounded bg-surface-2 px-1 font-mono text-xs">npm run embed &amp;&amp; npm run precompute</code> once and
        commit the two JSON files in <code className="rounded bg-surface-2 px-1 font-mono text-xs">src/data/</code>.
      </p>
    </div>
  );
}
