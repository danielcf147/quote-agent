/**
 * The 1200x630 preview shown when the demo link is shared (Open Graph and
 * Twitter Card). Rendered by next/og at build time, in the page's light palette.
 */
import { ImageResponse } from "next/og";
import { getProduct } from "./catalog";
import { money } from "./format";
import { SITE } from "./site";

export const SHARE_IMAGE = {
  alt: `${SITE.name}: an AI agent that turns plain-language purchase requests into priced quotes. Built by ${SITE.author}.`,
  size: { width: 1200, height: 630 },
  contentType: "image/png",
} as const;

const C = {
  bg: "#f6f5f1",
  surface: "#ffffff",
  ink: "#1c1b18",
  ink2: "#57544c",
  ink3: "#8a867b",
  line: "#e2dfd5",
  accent: "#155e4f",
  accentSoft: "#e2efe9",
  highlight: "#2f6fdb",
};

export function renderShareImage() {
  const pipette = getProduct("INS-MP-P100")!;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: C.bg,
          color: C.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: C.accent }} />
          {SITE.name}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 960 }}>
            {SITE.tagline}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                padding: "18px 24px",
                borderRadius: 16,
                background: C.surface,
                border: `2px solid ${C.line}`,
                fontSize: 24,
                color: C.ink2,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <span>“two of those&nbsp;</span>
              <span style={{ color: C.highlight, fontWeight: 600 }}>100 µl pipettes</span>
              <span>”</span>
            </div>
            <div style={{ fontSize: 36, color: C.ink3 }}>→</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "16px 24px",
                borderRadius: 16,
                background: C.accentSoft,
                fontSize: 22,
              }}
            >
              <span style={{ fontWeight: 600 }}>{pipette.name}</span>
              <span style={{ color: C.accent }}>2 × {money(pipette.price)} · matched and verified</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: C.ink3 }}>
          <span>Built by {SITE.author}</span>
          <span>{SITE.url.replace("https://", "")}</span>
        </div>
      </div>
    ),
    { ...SHARE_IMAGE.size },
  );
}
