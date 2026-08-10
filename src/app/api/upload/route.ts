// Upload into the user's sandbox only -- the playground is read-only by
// construction (this route refuses it). Validation here is the polite
// layer; rag-api's persist endpoint enforces the same quotas for real
// (token-pages per doc, docs per tenant), so nothing rides on this.
import { NextRequest } from "next/server";
import { ensureTenant, resolveTenant } from "@/lib/tenant";
import { track } from "@/lib/track";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  if (!rateLimit(clientIp(request), 20)) {
    return new Response("slow down — too many uploads this minute", {
      status: 429,
    });
  }
  const resolved = await resolveTenant("sandbox");
  if (!resolved) return new Response("sign in first", { status: 401 });
  await ensureTenant(resolved.tenant);
  track(request, "upload", {}, undefined, resolved.tenant);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("no file", { status: 422 });
  }
  if (!/\.(md|markdown|pdf|docx|html?|txt)$/i.test(file.name)) {
    return new Response(
      "unsupported type. markdown, pdf, docx, html, or plain text.",
      { status: 415 },
    );
  }
  if (file.size > 8 * 1024 * 1024) {
    return new Response("file too large. the limit is 8 MB.", { status: 413 });
  }
  const upstream = await fetch(
    `${process.env.RAG_INGEST_URL}/ingest?include_text=false`,
    {
      method: "POST",
      headers: { "x-tenant-slug": resolved.tenant },
      body: form,
    },
  );
  return new Response(await upstream.text(), { status: upstream.status });
}
