"use client";

import { useState, useSyncExternalStore } from "react";
import { displayProvider as provider } from "@/lib/provider";

const STORAGE_KEY = `quote-agent:${provider.id}-key`;

export function readStoredKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function writeStoredKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing is kept, the visitor will be asked again.
  }
  listeners.forEach((l) => l());
}

/** The current key, kept in sync across components. */
export function useStoredKey(): string | null {
  return useSyncExternalStore(subscribe, readStoredKey, () => null);
}

/**
 * The visitor's key lives only in this tab's sessionStorage and is sent
 * straight from the browser to the provider's API. It never reaches our server.
 */
export function KeyField() {
  const stored = useStoredKey();
  const [draft, setDraft] = useState("");

  function save() {
    const key = draft.trim();
    if (!key) return;
    writeStoredKey(key);
    setDraft("");
  }

  const clear = () => writeStoredKey(null);

  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      {stored ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            Key in use: <span className="font-mono text-ink-2">{stored.slice(0, 7)}…{stored.slice(-4)}</span>
          </p>
          <button type="button" onClick={clear} className="text-sm font-medium text-bad hover:underline">
            Forget key
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="api-key" className="sr-only">
            {provider.label} API key
          </label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={provider.keyPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent/15"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-40"
          >
            Use this key
          </button>
        </form>
      )}
      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-3">
        <li>
          <strong className="font-medium text-ink-2">Kept only in this tab</strong> (sessionStorage). Closing the tab erases it;
          it is never written to cookies, localStorage or any server.
        </li>
        <li>
          <strong className="font-medium text-ink-2">Sent only to {provider.host}</strong>, directly from your browser. This
          site&rsquo;s server never sees it.
        </li>
        <li>
          No key yet?{" "}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
            Get one from {provider.id === "gemini" ? "Google AI Studio (free tier available)" : "the OpenAI dashboard"}
          </a>
          .
        </li>
      </ul>
    </div>
  );
}
