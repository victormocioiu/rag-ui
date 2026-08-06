import { resolveTenant } from "@/lib/tenant";

export async function GET() {
  const resolved = await resolveTenant("sandbox");
  if (!resolved) return Response.json({ usage: null });
  const upstream = await fetch(`${process.env.RAG_API_URL}/internal/usage`, {
    headers: { "x-tenant-slug": resolved.tenant },
    cache: "no-store",
  });
  if (!upstream.ok) return Response.json({ usage: null });
  return Response.json({ usage: await upstream.json() });
}
