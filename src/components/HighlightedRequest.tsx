import type { CSSProperties } from "react";
import { hue } from "@/lib/format";
import type { QuoteLine } from "@/lib/types";

interface Props {
  text: string;
  lines: QuoteLine[];
  active: number | null;
  onHover: (index: number | null) => void;
}

/** The original request with every extracted fragment highlighted in its item's color. */
export function HighlightedRequest({ text, lines, active, onHover }: Props) {
  const spans = lines
    .filter((l): l is QuoteLine & { span: [number, number] } => l.span !== null)
    .sort((a, b) => a.span[0] - b.span[0]);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const l of spans) {
    const [start, end] = l.span;
    if (start < cursor) continue; // overlapping fragments: keep the first
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={l.index}
        className="hl cursor-default text-ink"
        style={{ "--hue": hue(l.index) } as CSSProperties}
        data-active={active === l.index}
        onMouseEnter={() => onHover(l.index)}
        onMouseLeave={() => onHover(null)}
      >
        {text.slice(start, end)}
        <sup className="ml-0.5 font-mono text-[10px] font-semibold" style={{ color: hue(l.index) }}>
          {l.index + 1}
        </sup>
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <p className="whitespace-pre-wrap text-[15px] leading-8 text-ink-2">{parts}</p>;
}
