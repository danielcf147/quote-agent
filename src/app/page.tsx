import { QuoteApp } from "@/components/QuoteApp";
import { catalog } from "@/lib/catalog";
import { money } from "@/lib/format";
import { displayProvider as ai } from "@/lib/provider";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

const STEPS = [
  {
    title: "Extract",
    body: `${ai.chatModel} turns free text, in any language, into line items with a verbatim source fragment, a neutral search query, a quantity and a normalized unit. Structured output with a strict JSON schema, so the response always parses.`,
  },
  {
    title: "Embed",
    body: `Each search query is embedded with ${ai.embeddingModel} (${ai.dimensions} dims) in one batched call. The ${catalog.length} catalog products were embedded once by a script and the vectors are committed as JSON.`,
  },
  {
    title: "Match",
    body: "Cosine similarity against every product, in memory. No vector database: at this catalog size a linear scan takes about a millisecond. Two thresholds decide between matched, needs review and not quoted.",
  },
  {
    title: "Price",
    body: "Requested amounts are converted to selling units (5 L of solvent becomes two 4 L bottles or five 1 L bottles, rounded up and explained) and priced from the catalog.",
  },
];

export default function Home() {
  const byCategory = Object.entries(
    catalog.reduce<Record<string, typeof catalog>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {}),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="inline-block size-2.5 rounded-sm bg-accent" aria-hidden />
          Quote Agent
        </p>
        <nav className="flex items-center gap-5 text-sm text-ink-2">
          <a href="#how-it-works" className="hover:text-ink">
            How it works
          </a>
          <a href="#catalog" className="hover:text-ink">
            Catalog
          </a>
          {REPO_URL && (
            <a href={REPO_URL} className="hover:text-ink" target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </nav>
      </header>

      <section className="pb-8 pt-6 sm:pt-10">
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-[42px]">
          Purchase requests in plain words, turned into priced quotes.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
          Customers write &ldquo;two of those 100&nbsp;µl pipettes&rdquo;. Catalogs say &ldquo;Single-Channel Adjustable
          Micropipette, 10–100&nbsp;µL&rdquo;. This agent bridges the two with an LLM and vector search, and shows its work
          for every line.
        </p>
      </section>

      <QuoteApp />

      <section id="how-it-works" className="scroll-mt-6 pt-20">
        <h2 className="text-xl font-semibold tracking-tight text-ink">How it works</h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-surface p-5">
              <p className="font-mono text-xs text-ink-3">0{i + 1}</p>
              <h3 className="mt-2 font-medium text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-3">
          Why vectors and not keywords? The catalog deliberately uses formal names (&ldquo;2-Propanol&rdquo;,
          &ldquo;Acrylonitrile-Butadiene Examination Gloves&rdquo;) that share almost no words with how people ask for things.
          Each trace card shows what a plain keyword search would have picked for comparison.
        </p>
      </section>

      <section id="catalog" className="scroll-mt-6 pt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Catalog</h2>
          <p className="text-sm text-ink-3">{catalog.length} fictional products · prices in USD</p>
        </div>
        <div className="mt-6 space-y-2">
          {byCategory.map(([category, products]) => (
            <details key={category} className="group rounded-xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium text-ink">{category}</span>
                <span className="flex items-center gap-3 text-ink-3">
                  {products.length}
                  <span className="transition-transform group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.sku} className="border-b border-line/70 align-top last:border-0">
                        <td className="w-36 py-2.5 pl-4 font-mono text-xs text-ink-3">{p.sku}</td>
                        <td className="py-2.5 pr-3">
                          <p className="text-ink">{p.name}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{p.description}</p>
                        </td>
                        <td className="w-32 py-2.5 pr-3 text-xs text-ink-2">{p.unit}</td>
                        <td className="w-24 py-2.5 pr-4 text-right text-ink tabular">{money(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-xs leading-relaxed text-ink-3">
        Portfolio demo. Catalog, prices and example requests are fictional. No database, no tracking, no stored keys.
      </footer>
    </div>
  );
}
