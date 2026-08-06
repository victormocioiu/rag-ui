// User -> tenant mapping. Every signed-in user gets a private sandbox
// tenant (RLS does the actual isolation, server-side, always); the
// playground is the shared read-only ERB corpus.
import { createHash } from "crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const PLAYGROUND_TENANT = "erb-v1";
const API = process.env.RAG_API_URL ?? "";

export async function resolveTenant(
  mode: string,
): Promise<{ tenant: string; sandbox: boolean } | null> {
  if (mode === "playground") {
    return { tenant: PLAYGROUND_TENANT, sandbox: false };
  }
  if (process.env.AUTH_DISABLED === "1") {
    return { tenant: "dev-sandbox", sandbox: true };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const slug = "u-" + createHash("sha256")
    .update(session.user.id).digest("hex").slice(0, 12);
  return { tenant: slug, sandbox: true };
}

export async function ensureTenant(slug: string): Promise<void> {
  await fetch(`${API}/internal/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
}
