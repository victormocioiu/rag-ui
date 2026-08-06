// The front door: the kami-typeset landing page, served at the root for
// everyone who hasn't read the articles. Eager visitors flow
// landing -> sign-in -> /app.
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), "src", "landing.html"), "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
