import { connection } from "next/server";
import { LIMITS } from "@/lib/config";
import { liveConfig } from "@/lib/live";

export async function GET() {
  await connection(); // read env at request time, not at build time
  const cfg = liveConfig();
  return Response.json({
    live: cfg.enabled
      ? { enabled: true, ...LIMITS.live, perWindow: cfg.perWindow, windowMinutes: cfg.windowMs / 60_000 }
      : { enabled: false },
  });
}
