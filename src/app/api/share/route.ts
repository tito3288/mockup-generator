import { NextResponse } from "next/server";
import { expiryMs, newPreviewId, saveHtml } from "@/lib/preview-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const html = (body as { html?: unknown })?.html;
  if (typeof html !== "string" || html.length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid html" },
      { status: 400 },
    );
  }

  const id = newPreviewId();
  await saveHtml(id, html);

  const proto =
    request.headers.get("x-forwarded-proto") ??
    (request.url.startsWith("https://") ? "https" : "http");
  const host = request.headers.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/preview/${id}`;
  const expiresAt = Date.now() + expiryMs();

  return NextResponse.json({ id, url, expiresAt });
}
