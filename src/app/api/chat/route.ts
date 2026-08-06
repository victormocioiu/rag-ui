// SSE passthrough to rag-api /chat. The browser never sees tenant
// headers or internal URLs; this route is the only door.
import { NextRequest } from "next/server";
import { ensureTenant, resolveTenant } from "@/lib/tenant";
import { track } from "@/lib/track";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const resolved = await resolveTenant(body.mode ?? "playground");
  if (!resolved) return new Response("sign in first", { status: 401 });
  if (resolved.sandbox) await ensureTenant(resolved.tenant);
  track(request, "ask", { mode: body.mode, model: body.model ?? "default",
                          rerank: !!body.rerank }, undefined, resolved.tenant);

  const upstream = await fetch(`${process.env.RAG_API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": resolved.tenant,
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
