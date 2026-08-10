// Per-IP sliding-window rate limit, in-process. rag-ui runs a single
// replica, so one Map is the whole picture; if it ever scales out the
// limit becomes per-replica (looser) — the daily token budget in rag-api
// stays the real global spend cap regardless. This just stops one IP
// from draining the shared anon pool or hammering the LLM in a burst.
import { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Returns true if the request is allowed. `max` requests per 60s per ip.
export function rateLimit(ip: string, max: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    buckets.set(ip, hits);
    return false;
  }
  hits.push(now);
  buckets.set(ip, hits);

  // opportunistic sweep so the Map can't grow unbounded under a hug
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
  return true;
}
