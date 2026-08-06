import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET() {
  if (process.env.AUTH_DISABLED === "1") {
    return Response.json({ user: { name: "dev", dev: true } });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  return Response.json({ user: session?.user ?? null });
}
