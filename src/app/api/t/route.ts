// Client-side beacon endpoint: pageviews and UI events.
import { NextRequest } from "next/server";
import { track } from "@/lib/track";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  track(request, body.event ?? "pageview", body.props ?? {});
  return new Response(null, { status: 204 });
}
