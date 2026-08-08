// SSE passthrough to rag-api /chat. The browser never sees tenant
// headers or internal URLs; this route is the only door. A session is
// required for BOTH modes: retrieval may hit the shared playground
// corpus, but the tokens always bill the asking user's own budget --
// which also means anonymous scripts get 401, not a shared free pool.
import { NextRequest } from "next/server";
import { PLAYGROUND_TENANT, ensureTenant, resolveTenant } from "@/lib/tenant";
import { track } from "@/lib/track";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await resolveTenant("sandbox");
  if (!user) return new Response("sign in first", { status: 401 });
  await ensureTenant(user.tenant);
  const retrieval =
    (body.mode ?? "playground") === "playground" ? PLAYGROUND_TENANT : user.tenant;
  track(request, "ask", { mode: body.mode, model: body.model ?? "default",
                          rerank: !!body.rerank }, undefined, user.tenant);

  const upstream = await fetch(`${process.env.RAG_API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": retrieval,
      "x-billing-tenant-slug": user.tenant,
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
