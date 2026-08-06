// Upload into the user's sandbox only -- the playground is read-only by
// construction (this route refuses it). Quota enforcement's real home is
// the platform; the UI's 10-doc cap is a courtesy, not a control.
import { NextRequest } from "next/server";
import { ensureTenant, resolveTenant } from "@/lib/tenant";
import { track } from "@/lib/track";

export async function POST(request: NextRequest) {
  const resolved = await resolveTenant("sandbox");
  if (!resolved) return new Response("sign in first", { status: 401 });
  await ensureTenant(resolved.tenant);
  track(request, "upload", {}, undefined, resolved.tenant);

  const form = await request.formData();
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
