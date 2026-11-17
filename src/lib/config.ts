/**
 * Central knobs for the pipeline. Thresholds were chosen for
 * text-embedding-3-small; `npm run precompute` prints the scores of every
 * example so they can be re-calibrated after changing models.
 */
export const CHAT_MODEL = "gpt-4.1-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 512;

/** At or above: matched with high confidence. */
export const HIGH_CONFIDENCE = 0.55;
/** Below this the item is not quoted at all. Between the two: quoted, flagged for review. */
export const MIN_SIMILARITY = 0.4;
/** If the runner-up is closer than this, the match is flagged as ambiguous. */
export const AMBIGUITY_MARGIN = 0.02;

export const TOP_K = 3;

export const LIMITS = {
  byok: { maxItems: 25, maxChars: 4000 },
  live: { maxItems: 8, maxChars: 800 },
} as const;

/** USD per 1M tokens, used only for the cost estimate shown in the trace. */
export const PRICING = {
  chatInput: 0.4,
  chatOutput: 1.6,
  embedding: 0.02,
};

export const QUOTE_VALIDITY_DAYS = 30;
