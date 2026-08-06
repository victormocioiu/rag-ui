// First-party event capture. Server-side only: reads what the ad-tech
// world reads (ip, ua, language, referrer) from the request itself and
// forwards to rag-api's internal sink. Fire-and-forget -- analytics must
// never slow a user down.
import { createHash } from "crypto";
import { NextRequest } from "next/server";

export function track(
  request: NextRequest,
  event: string,
  props: Record<string, unknown> = {},
  userId?: string,
  tenant?: string,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ?? null;
  const row = {
    event,
    path: new URL(request.url).pathname,
    ip,
    user_agent: request.headers.get("user-agent") ?? "",
    language: request.headers.get("accept-language") ?? "",
    referrer: request.headers.get("referer") ?? "",
    country: request.headers.get("cf-ipcountry") ?? null,
    user_hash: userId
      ? createHash("sha256").update(userId).digest("hex").slice(0, 16)
      : null,
    tenant_slug: tenant ?? null,
    props,
  };
  fetch(`${process.env.RAG_API_URL}/internal/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([row]),
  }).catch(() => {});
}
