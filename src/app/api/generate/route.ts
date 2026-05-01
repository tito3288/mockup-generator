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
  screenshots?: unknown;
};

type AllowedImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BASE64_BYTES = 7 * 1024 * 1024;

function parseScreenshotDataUrl(
  dataUrl: string,
): { mediaType: AllowedImageMediaType; base64: string } | null {
  const match = dataUrl.match(
    /^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/,
  );
  if (!match) return null;
  return {
    mediaType: match[1] as AllowedImageMediaType,
    base64: match[3],
  };
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function buildPrompt(args: {
  urls: string[];
  currentSite: string;
  brandColor: string;
  clientName: string;
  screenshotCount: number;
}) {
  const { urls, currentSite, brandColor, clientName, screenshotCount } = args;
  const colorLine = brandColor.trim() ? brandColor.trim() : "designer's choice";
  const hasUrls = urls.length > 0;
  const urlLabel = urls.length === 1 ? "Inspiration URL" : "Inspiration URLs";
  const urlLine = hasUrls
    ? `${urlLabel}: ${urls.join(", ")}`
    : "Inspiration URLs: (none provided — rely on the screenshots)";

  const screenshotBlock =
    screenshotCount > 0
      ? `INSPIRATION SCREENSHOTS:
You have been provided ${screenshotCount} reference screenshot${screenshotCount === 1 ? "" : "s"} above this text. These are NOT decorative — they are a primary visual reference for this project. Look at them carefully. Note color palette, typography style, photography mood, layout treatments, and overall vibe. The mockups must visibly echo what you see in these screenshots.

`
      : "";

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

  return `You are a senior web designer. Analyze the provided inspiration sources and create 3 visually distinct homepage mockups for ${clientName}.

${screenshotBlock}${currentSiteBlock}${urlLine}
Brand colors: ${colorLine}

LOGO IMAGE — IMPORTANT:
Wherever you want the client's logo to appear (typically in the header), use the literal placeholder string \`${LOGO_PLACEHOLDER}\` as the src value. Example:
<img src="${LOGO_PLACEHOLDER}" alt="${clientName} logo" class="h-14 w-auto md:h-16" />
Make the header logo visually prominent — roughly 56–72px tall on desktop (Tailwind h-14 to h-18, or larger if the design calls for it). Avoid sizes smaller than h-12 in the header; a tiny logo reads as unfinished. Always pair height with \`w-auto\` so the aspect ratio is preserved. Footer or inline mentions can be smaller.
Do NOT generate a base64 or data URL yourself. The server will substitute the real logo into every occurrence of \`${LOGO_PLACEHOLDER}\` after you finish.

For each of the 3 mockups:
- Make it a complete standalone HTML file
- Include the mobile viewport tag in <head>: <meta name="viewport" content="width=device-width, initial-scale=1">
- Use Tailwind CSS via CDN
- Include: header with logo, hero section, services or features section, testimonials or social proof, CTA section, footer
- Each of the 3 must have a distinctly different layout, typography feel, and visual approach
- Use real-looking placeholder content relevant to ${clientName}, not lorem ipsum
- Make them production-quality, not wireframes
- Fully responsive — design mobile-first, then layer up. Use Tailwind responsive prefixes (sm:, md:, lg:) on layout, typography, spacing, and any multi-column grids. The mockup must read cleanly at 375px (phone), 768px (tablet), and 1280px+ (desktop). No horizontal scroll on mobile. Stack columns on small screens; collapse the header nav into a mobile-friendly pattern (hamburger or stacked links) below md. Hero typography should scale down for small screens (e.g. text-4xl sm:text-5xl lg:text-6xl).

INSPIRATION AUDIT — INTERNAL REASONING ONLY:
Before designing, internally analyze each inspiration source — URL${screenshotCount > 0 ? " or screenshot" : ""} — across these dimensions. Do NOT write the audit in your response; keep it as silent reasoning that informs the HTML you generate.
${hasUrls ? "For each URL, use the web_fetch tool to read it (one fetch per URL) and reason from text/HTML/CSS. " : ""}${screenshotCount > 0 ? "For each screenshot above, perceive the rendered visuals directly — the screenshots are your strongest signal. " : ""}Dimensions to consider:
- **Color palette**: specific hex codes${screenshotCount > 0 ? " (estimate from the screenshots; for URLs, extract from CSS or inline styles)" : " (extract from CSS, inline styles, computed values, or background colors)"}. Distinguish primary, accent, surface, and foreground.
- **Typography**: heading font family + fallback stack, body font family, weights, type-scale character.
- **Photography / imagery style**: ${screenshotCount > 0 ? "from screenshots: moody/clinical, warm/lifestyle, editorial, etc., plus dominant subjects. From URLs: infer from <img>, alt, filenames." : "from <img> tags, alt text, src filenames, and copy — infer the imagery vibe and dominant subjects."}
- **Layout DNA**: hero treatment, grid choices, density, distinctive visual moves.
- **Overall aesthetic vibe**: 3-5 words (e.g. "moody clinical luxury").

Each of the 3 mockups MUST visibly reflect signals from this internal audit — palette echoes, typography feel, photography mood, distinctive layout moves. Do NOT produce a generic "tasteful agency" design. If the inspiration is dark and dramatic, at least one mockup must lean dark and dramatic. The 3 should be three distinct interpretations OF the inspirations, not generic alternatives ignoring them.

${screenshotCount > 0 ? "NOTE: The screenshots are your richest input — you can actually see them. Treat them as the primary visual reference. URLs supplement with text/copy/structure." : "NOTE: web_fetch returns text/HTML, not pixels. Read filenames, alt text, CSS background-image URLs, and declared color/typography to ground the audit."}

SIZE BUDGET — IMPORTANT:
Each mockup HTML must be focused and lean — aim for under **10,000 characters** per mockup. Use Tailwind utility classes efficiently. Do NOT duplicate sections, do NOT include placeholder lorem-style filler, do NOT inline long SVGs when a small set of components will do.

OUTPUT FORMAT — STRICT:
Return EXACTLY three Markdown code blocks, each preceded by a Design header. Use tilde fences (~~~) — NOT backticks — to avoid escaping issues. Use this exact structure:

## Design A
~~~html
<!DOCTYPE html>
... full HTML for Design A ...
</html>
~~~

## Design B
~~~html
<!DOCTYPE html>
... full HTML for Design B ...
</html>
~~~

## Design C
~~~html
<!DOCTYPE html>
... full HTML for Design C ...
</html>
~~~

The very first line of your response must be \`## Design A\`. No prose before, between, or after the blocks. No audit notes. No JSON. No explanations. Just the three Design headers and their fenced HTML blocks. The HTML inside each fence is raw — do NOT escape any characters; write HTML exactly as it should appear in the file.`;
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

  // Find the JSON object that starts with { "mockups": ... and walk
  // forward with brace balancing (respecting strings) to its matching }.
  // This is robust to prose preceding or following the JSON.
  const startMatch = trimmed.match(/\{\s*["']mockups["']/);
  if (startMatch && typeof startMatch.index === "number") {
    const start = startMatch.index;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (c === "\\") escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1));
          } catch {}
          break;
        }
      }
    }
  }

  // Last-resort fallback: outermost braces
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

// Primary parser: extract three mockups from Markdown-fenced code blocks.
// Accepts both tilde (~~~) and backtick (```) fences. Looks for `## Design X`
// (or similar) headers to name each block; falls back to Design A/B/C if absent.
function parseMarkdownMockups(text: string): Mockup[] | null {
  const fenceRegex = /(?:~~~|```)(?:html)?\s*\n([\s\S]*?)\n(?:~~~|```)/g;
  const blocks: { html: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(text)) !== null) {
    const html = m[1].trim();
    if (html.length > 0) blocks.push({ html, index: m.index });
  }
  if (blocks.length !== 3) return null;

  return blocks.map((block, i) => {
    const sliceStart = i === 0 ? 0 : blocks[i - 1].index;
    const headerSearch = text.slice(sliceStart, block.index);
    const headerMatch = headerSearch.match(
      /##\s+([A-Z][A-Za-z0-9 _-]*[A-Za-z0-9])/,
    );
    const name = headerMatch
      ? headerMatch[1].trim()
      : `Design ${String.fromCharCode(65 + i)}`;
    return { name, html: block.html };
  });
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON");
  }

  const { urls, currentSite, logoDataUrl, brandColor, clientName, screenshots } = body;

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

  const parsedScreenshots: { mediaType: AllowedImageMediaType; base64: string }[] = [];
  if (screenshots !== undefined) {
    if (!Array.isArray(screenshots) || !screenshots.every((s) => typeof s === "string")) {
      return badRequest("Screenshots must be an array of image data URL strings");
    }
    if (screenshots.length > MAX_SCREENSHOTS) {
      return badRequest(`Provide at most ${MAX_SCREENSHOTS} screenshots`);
    }
    for (const dataUrl of screenshots as string[]) {
      if (dataUrl.length > MAX_SCREENSHOT_BASE64_BYTES) {
        return badRequest("One of the screenshots is over 5MB");
      }
      const parsed = parseScreenshotDataUrl(dataUrl);
      if (!parsed) {
        return badRequest("Screenshots must be PNG, JPEG, GIF, or WEBP data URLs");
      }
      parsedScreenshots.push(parsed);
    }
  }

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
    screenshotCount: parsedScreenshots.length,
  });

  const client = new Anthropic({ apiKey });

  const startedAt = Date.now();
  console.log("[generate] request received", {
    clientName: clientName.trim(),
    inspirationUrls: cleanedUrls.length,
    screenshotCount: parsedScreenshots.length,
    currentSite: currentSiteStr.trim() || null,
    logoBytes: logoDataUrl.length,
    promptChars: prompt.length,
  });

  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [
    ...parsedScreenshots.map(
      (s) =>
        ({
          type: "image",
          source: { type: "base64", media_type: s.mediaType, data: s.base64 },
        }) satisfies Anthropic.Beta.BetaImageBlockParam,
    ),
    { type: "text", text: prompt },
  ];

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
      messages: [{ role: "user", content: userContent }],
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

    // Primary path: Markdown-fenced output (current prompt format).
    // Fallback: legacy JSON output (in case the model reverts to it).
    let rawMockups: Mockup[] | null = parseMarkdownMockups(text);
    let parseSource: "markdown" | "json" = "markdown";
    if (!rawMockups) {
      try {
        const parsed = extractJson(text);
        if (isValidMockups(parsed)) {
          rawMockups = parsed.mockups;
          parseSource = "json";
        }
      } catch {
        // fall through to the error below
      }
    }
    if (!rawMockups) {
      throw new Error("Model response did not match the expected mockups shape");
    }

    const mockups = rawMockups.map((m) => ({
      name: m.name,
      html: m.html.split(LOGO_PLACEHOLDER).join(logoDataUrl),
    }));
    const placeholderHits = rawMockups.map(
      (m) => m.html.split(LOGO_PLACEHOLDER).length - 1,
    );

    const totalHtmlChars = mockups.reduce((n, m) => n + m.html.length, 0);
    console.log("[generate] success", {
      mockups: mockups.length,
      parseSource,
      placeholderReplacementsPerMockup: placeholderHits,
      screenshotCount: parsedScreenshots.length,
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
