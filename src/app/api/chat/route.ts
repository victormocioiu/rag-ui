// SSE passthrough to rag-api /chat. The browser never sees tenant
// headers or internal URLs; this route is the only door. The playground
// (benchmark corpus) is open to everyone -- no login -- and bills a
// shared anon tenant. The private sandbox requires a session.
import { NextRequest } from "next/server";
import {
  ANON_BILLING_TENANT,
  PLAYGROUND_TENANT,
  ensureTenant,
  resolveTenant,
} from "@/lib/tenant";
import { track } from "@/lib/track";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  // 15 questions/min/IP: generous for a human (rerank makes each ~17s),
  // brutal for a script draining the shared anon token pool.
  if (!rateLimit(clientIp(request), 15)) {
    return new Response("slow down — too many questions this minute", {
      status: 429,
    });
  }
  const body = await request.json();
  const isPlayground = (body.mode ?? "playground") === "playground";
  const user = await resolveTenant("sandbox"); // null when anonymous

  if (!isPlayground && !user) {
    return new Response("sign in to use your sandbox", { status: 401 });
  }

  const retrieval = isPlayground ? PLAYGROUND_TENANT : user!.tenant;
  const billing = isPlayground ? ANON_BILLING_TENANT : user!.tenant;
  await ensureTenant(billing);

  track(request, "ask", { mode: body.mode, model: body.model ?? "default",
                          rerank: !!body.rerank, anon: !user },
        undefined, user?.tenant ?? ANON_BILLING_TENANT);

  const upstream = await fetch(`${process.env.RAG_API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": retrieval,
      "x-billing-tenant-slug": billing,
    },
    body: JSON.stringify({
      query: body.query,
      stream: true,
      ...(body.model ? { model: body.model } : {}),
      ...(body.rerank ? { rerank: true } : {}),
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
