import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

type Mockup = { name: string; html: string };

const LOGO_PLACEHOLDER = "__LOGO_DATA_URL__";

type RequestBody = {
  urls?: unknown;
  currentSite?: unknown;
  logoDataUrl?: unknown;
  brandColor?: unknown;
  clientName?: unknown;
};

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function buildPrompt(args: {
  urls: string[];
  currentSite: string;
  brandColor: string;
  clientName: string;
}) {
  const { urls, currentSite, brandColor, clientName } = args;
  const colorLine = brandColor.trim() ? brandColor.trim() : "designer's choice";
  const urlLabel = urls.length === 1 ? "Inspiration URL" : "Inspiration URLs";

  const currentSiteBlock = currentSite.trim()
    ? `CLIENT'S CURRENT WEBSITE (canonical brand truth): ${currentSite.trim()}

Before designing, use the web_fetch tool to read this site FIRST. Extract:
- Real brand voice and tone of copy
- Actual services/products they offer (use these — do NOT invent)
- Existing color palette and typography choices
- Real testimonials, taglines, or social proof if present

Treat anything from the current site as canonical. Use the inspiration URLs only for visual layout/aesthetic direction, never for copy or brand voice.

`
    : "";

  return `You are a senior web designer. Analyze these inspiration URLs and create 3 visually distinct homepage mockups for ${clientName}.

${currentSiteBlock}${urlLabel}: ${urls.join(", ")}
Brand color: ${colorLine}

LOGO IMAGE — IMPORTANT:
Wherever you want the client's logo to appear (typically in the header), use the literal placeholder string \`${LOGO_PLACEHOLDER}\` as the src value. Example:
<img src="${LOGO_PLACEHOLDER}" alt="${clientName} logo" class="h-8" />
Do NOT generate a base64 or data URL yourself. The server will substitute the real logo into every occurrence of \`${LOGO_PLACEHOLDER}\` after you finish.

For each of the 3 mockups:
- Make it a complete standalone HTML file
- Use Tailwind CSS via CDN
- Include: header with logo, hero section, services or features section, testimonials or social proof, CTA section, footer
- Each of the 3 must have a distinctly different layout, typography feel, and visual approach
- Use real-looking placeholder content relevant to ${clientName}, not lorem ipsum
- Make them production-quality, not wireframes

Use the web_fetch tool to actually read each inspiration URL before designing, so the mockups draw on the real visual language of those sites.

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{ "mockups": [ { "name": "Design A", "html": "..." }, { "name": "Design B", "html": "..." }, { "name": "Design C", "html": "..." } ] }`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {}
  }

  throw new Error("Model response was not valid JSON");
}

function isValidMockups(value: unknown): value is { mockups: Mockup[] } {
  if (typeof value !== "object" || value === null) return false;
  const mockups = (value as { mockups?: unknown }).mockups;
  if (!Array.isArray(mockups) || mockups.length !== 3) return false;
  return mockups.every(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      typeof (m as Mockup).name === "string" &&
      typeof (m as Mockup).html === "string" &&
      (m as Mockup).html.length > 0,
  );
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON");
  }

  const { urls, currentSite, logoDataUrl, brandColor, clientName } = body;

  if (
    !Array.isArray(urls) ||
    !urls.every((u) => typeof u === "string")
  ) {
    return badRequest("Inspiration URLs must be an array of strings");
  }
  const cleanedUrls = (urls as string[])
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (cleanedUrls.length === 0) {
    return badRequest("Provide at least one inspiration URL");
  }
  if (cleanedUrls.length > 3) {
    return badRequest("Provide at most 3 inspiration URLs");
  }
  if (typeof logoDataUrl !== "string" || !logoDataUrl.startsWith("data:image/")) {
    return badRequest("Logo must be uploaded as an image data URL");
  }
  if (typeof clientName !== "string" || clientName.trim().length === 0) {
    return badRequest("Client name is required");
  }
  const colorStr = typeof brandColor === "string" ? brandColor : "";
  if (currentSite !== undefined && typeof currentSite !== "string") {
    return badRequest("Current site must be a string if provided");
  }
  const currentSiteStr = typeof currentSite === "string" ? currentSite : "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }

  const prompt = buildPrompt({
    urls: cleanedUrls,
    currentSite: currentSiteStr,
    brandColor: colorStr,
    clientName: clientName.trim(),
  });

  const client = new Anthropic({ apiKey });

  const startedAt = Date.now();
  console.log("[generate] request received", {
    clientName: clientName.trim(),
    inspirationUrls: cleanedUrls.length,
    currentSite: currentSiteStr.trim() || null,
    logoBytes: logoDataUrl.length,
    promptChars: prompt.length,
  });

  try {
    console.log("[generate] streaming Claude (model=claude-sonnet-4-5, max_tokens=48000, web_fetch max_uses=8, max_content_tokens=12000)…");
    const stream = client.beta.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 48000,
      betas: ["web-fetch-2025-09-10"],
      tools: [
        {
          type: "web_fetch_20250910",
          name: "web_fetch",
          max_uses: 8,
          max_content_tokens: 12000,
        },
      ],
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("connect", () => {
      console.log(`[generate] connected (+${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
    });

    let textChars = 0;
    stream.on("streamEvent", (event) => {
      const t = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (event.type === "message_start") {
        console.log(`[generate] +${t}s message_start (model=${event.message.model})`);
      } else if (event.type === "content_block_start") {
        const b = event.content_block as { type: string; name?: string; input?: unknown };
        const label = b.name ? `${b.type}:${b.name}` : b.type;
        const inputPreview =
          b.input && typeof b.input === "object"
            ? ` ${JSON.stringify(b.input).slice(0, 200)}`
            : "";
        console.log(`[generate] +${t}s block_start [${event.index}] ${label}${inputPreview}`);
      } else if (event.type === "content_block_stop") {
        console.log(`[generate] +${t}s block_stop  [${event.index}]`);
      } else if (event.type === "message_delta") {
        console.log(`[generate] +${t}s message_delta stop_reason=${event.delta.stop_reason}`);
      }
    });

    stream.on("text", (delta) => {
      const before = textChars;
      textChars += delta.length;
      // Log every 5,000 text chars so we see writing progress without flooding
      if (Math.floor(before / 5000) !== Math.floor(textChars / 5000)) {
        const t = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`[generate] +${t}s writing… ${textChars} chars so far`);
      }
    });

    const response = await stream.finalMessage();

    const elapsedMs = Date.now() - startedAt;
    const blockCounts = response.content.reduce<Record<string, number>>((acc, b) => {
      acc[b.type] = (acc[b.type] ?? 0) + 1;
      return acc;
    }, {});
    console.log("[generate] Claude responded", {
      elapsedSec: (elapsedMs / 1000).toFixed(1),
      stop_reason: response.stop_reason,
      usage: response.usage,
      contentBlocks: blockCounts,
    });

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Model returned no text content");
    }

    const parsed = extractJson(text);
    if (!isValidMockups(parsed)) {
      throw new Error("Model response did not match the expected mockups shape");
    }

    const mockups = parsed.mockups.map((m) => ({
      name: m.name,
      html: m.html.split(LOGO_PLACEHOLDER).join(logoDataUrl),
    }));
    const placeholderHits = parsed.mockups.map(
      (m) => m.html.split(LOGO_PLACEHOLDER).length - 1,
    );

    const totalHtmlChars = mockups.reduce((n, m) => n + m.html.length, 0);
    console.log("[generate] success", {
      mockups: mockups.length,
      placeholderReplacementsPerMockup: placeholderHits,
      totalHtmlChars,
      elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
    });

    return NextResponse.json({ mockups });
  } catch (err) {
    console.error("[generate] failed after", ((Date.now() - startedAt) / 1000).toFixed(1), "s:", err);
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic API error: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Mockup generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
