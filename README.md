# Quote Agent

An AI agent that reads purchase requests written in plain language and turns them into priced quotes, and shows how it decided every line.

> "Could you send me a quote for 10 boxes of nitrile gloves size M, 5 liters of isopropyl alcohol and two of those 100 microliter pipettes?"

becomes a quote for *Acrylonitrile-Butadiene Examination Gloves, Medium*, *2-Propanol, ACS Reagent Grade* and *Single-Channel Adjustable Micropipette, 10–100 µL*, with quantities converted to selling units, prices, and a trace of the similarity scores, runner-up candidates and decisions behind each line.

Built with Next.js (App Router), TypeScript and Tailwind CSS. No database, no auth, no vector store, no recurring cost: it runs on the Vercel free tier.

## Why this is not keyword matching

The fictional catalog (80 lab and office products, `src/data/catalog.json`) deliberately uses formal procurement language: "2-Propanol" instead of "IPA", "Thermoplastic Sealing Film" instead of "parafilm", "Repositionable Adhesive Note Pads" instead of "post-its". Customers never write like that. Embeddings capture meaning across that gap; keywords don't. Every trace card shows what a naive keyword search would have picked for the same text, so the difference is visible.

## How it works

```
free text ──► 1. Extract ──► 2. Embed ──► 3. Match ──► 4. Price ──► quote + trace
              LLM, strict     one batched   cosine vs.    unit conversion,
              JSON schema     call          committed     thresholds,
                                            vectors       totals
```

Two AI providers are supported, Google Gemini and OpenAI (`src/lib/config.ts`). Whichever one embedded the catalog is used everywhere, because query vectors must come from the same model as the catalog vectors.

| | Gemini (default) | OpenAI |
| --- | --- | --- |
| Extraction | `gemini-3.8-flash`, low thinking | `gpt-4.1-mini` |
| Embeddings | `gemini-embedding-001`, 768 dims, document/query task types | `text-embedding-3-small`, 512 dims |
| Free tier | yes | no |

Providers retire model names often. Override the extraction model with `NEXT_PUBLIC_GEMINI_CHAT_MODEL` or `NEXT_PUBLIC_OPENAI_CHAT_MODEL` (see `.env.example`) and re-run `npm run precompute`.

1. **Extract** (`src/lib/extract.ts`). The chat model, through the provider's OpenAI-compatible Chat Completions API with a strict JSON schema, returns one entry per product: the verbatim fragment from the request, a neutral English search query, a quantity and a normalized unit (`pack`, `each`, `L`, `mL`, `kg`, `g`). Works for any input language.
2. **Embed**. All search queries are embedded in a single batched call (`src/lib/llm.ts`).
3. **Match** (`src/lib/vector.ts`). Cosine similarity against every catalog vector, in memory. The catalog vectors were computed once by a script and are committed as JSON. At this size a linear scan takes about a millisecond, so a vector database would add cost and nothing else.
4. **Decide and price** (`src/lib/pipeline.ts`, `src/lib/units.ts`).
   - score at or above the high threshold: matched.
   - between the two thresholds: quoted but flagged for human review.
   - below the minimum: not quoted. The agent says it found nothing rather than guessing.
   - runner-up within a small margin of the winner: flagged as ambiguous.

   Similarity scores are not comparable across embedding models, so each provider has its own thresholds.
   - "5 L" of a product sold in 4 L bottles becomes 2 bottles; "200 tips" sold in racks of 96 becomes 3 racks. Always rounded up, always explained.

Thresholds live in `src/lib/config.ts`. `npm run precompute` prints a calibration table of every score so they can be re-tuned after changing models.

## The trace panel

Next to the quote, each line shows:

- the exact fragment of the request it came from (also highlighted in the original text, with hover linking text, quote line and trace card);
- how the model understood it (search query, quantity, unit as written vs. normalized);
- the top 3 catalog candidates with similarity scores, drawn against the two decision thresholds;
- the decision and why, including ambiguity warnings;
- the unit conversion applied;
- what plain keyword search would have chosen;
- per-stage timings, token usage and the estimated cost of the run.

## Three modes

| Mode | Who pays | API calls | Notes |
| --- | --- | --- | --- |
| **Demo** (default) | nobody | none | Four example requests with results precomputed by the real pipeline and committed in `src/data/demo-results.json`. Loads instantly and works forever without any key. |
| **Your own key** | the visitor | from the visitor's browser straight to the provider (`generativelanguage.googleapis.com` or `api.openai.com`) | The key is kept only in `sessionStorage` for that tab and never sent to this app's server. The pipeline code is plain `fetch`, so the same module runs in the browser and on the server. |
| **Live** (off by default) | you | from the server | Enable with `LIVE_MODE_ENABLED=true`. Per-IP rate limit, a daily request budget, max 8 items and 800 characters per request. |

About the live-mode limiter: it is in memory, so on serverless platforms each instance enforces it separately. The daily budget bounds the worst case per instance. For a strictly global limit, swap `src/lib/rate-limit.ts` for a shared store such as Upstash Redis; it is the only file that changes. Set a spending limit in your provider account as the final guard.

## Running it

```bash
npm install
cp .env.example .env.local      # add GEMINI_API_KEY (free at aistudio.google.com/apikey) or OPENAI_API_KEY
npm run embed                   # writes src/data/catalog-embeddings.json
npm run precompute              # writes src/data/demo-results.json
npm run dev
```

`embed` and `precompute` fit in the Gemini free tier, or cost a fraction of a cent on OpenAI. Commit both JSON files: after that the deployed demo needs no key at all.

Re-run `npm run embed` whenever you change the catalog or the embedding model, then `npm run precompute`.

## Deploying to Vercel

Import the repository and deploy. No environment variables are needed for demo and bring-your-own-key modes. To enable live mode, add the key of the provider you embedded with (`GEMINI_API_KEY` or `OPENAI_API_KEY`) and `LIVE_MODE_ENABLED=true` (plus the optional limits from `.env.example`).

## Project layout

```
src/
  app/
    page.tsx               landing page, how-it-works, catalog browser
    api/quote/route.ts     live mode endpoint (rate-limited)
    api/status/route.ts    tells the UI whether live mode is enabled
  components/
    QuoteApp.tsx           modes, input, orchestration
    QuoteDocument.tsx      the quote itself
    ReasoningPanel.tsx     pipeline timings and per-line trace
    HighlightedRequest.tsx original text with extracted fragments
    KeyField.tsx           sessionStorage-only key handling
  data/
    catalog.json           80 fictional products
    catalog-embeddings.json  generated by `npm run embed`
    embeddings-meta.json   provider and model of those embeddings
    demo-results.json      generated by `npm run precompute`
  lib/
    pipeline.ts            extract → embed → match → price
    extract.ts             prompt and JSON schema
    llm.ts                 fetch-based Gemini/OpenAI client (browser + server)
    provider.ts            which provider the committed embeddings use
    vector.ts              cosine similarity, top-k
    units.ts               quantity to selling-unit conversion
    lexical.ts             naive keyword baseline for comparison
    rate-limit.ts          live-mode limiter
scripts/
  embed-catalog.ts
  precompute-demo.ts
```

## Disclaimer

All products, SKUs, prices and example requests are fictional and exist only for this demo.
