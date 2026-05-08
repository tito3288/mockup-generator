import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

type Mockup = { name: string; html: string };

const LOGO_PLACEHOLDER = "__LOGO_DATA_URL__";
const HERO_IMAGE_PLACEHOLDER = "__HERO_IMAGE_DATA_URL__";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

type RequestBody = {
  urls?: unknown;
  currentSite?: unknown;
  logoDataUrl?: unknown;
  brandColor?: unknown;
  clientName?: unknown;
  screenshots?: unknown;
  heroPhotoDataUrl?: unknown;
  heroDirection?: unknown;
  logoBackground?: unknown;
  generationProvider?: unknown;
  projectBrief?: unknown;
};

type LogoBackground = "light" | "dark" | "either";
type GenerationProvider = "anthropic" | "openai";

type AllowedImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";
type ParsedScreenshot = { mediaType: AllowedImageMediaType; base64: string };

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BASE64_BYTES = 7 * 1024 * 1024;
const MAX_HERO_PHOTO_BASE64_BYTES = 7 * 1024 * 1024;

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
  hasHeroPhoto: boolean;
  heroDirection: string;
  logoBackground: LogoBackground;
  generationProvider: GenerationProvider;
  projectBrief: string;
}) {
  const {
    urls,
    currentSite,
    brandColor,
    clientName,
    screenshotCount,
    hasHeroPhoto,
    heroDirection,
    logoBackground,
    generationProvider,
    projectBrief,
  } = args;
  const sourceToolName =
    generationProvider === "openai" ? "web_search" : "web_fetch";
  const sourceToolAction =
    generationProvider === "openai"
      ? "use the web_search tool to inspect this site FIRST"
      : "use the web_fetch tool to read this site FIRST";
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

Before designing, ${sourceToolAction}. Extract:
- Real brand voice and tone of copy
- Actual services/products they offer (use these — do NOT invent)
- Existing color palette and typography choices
- Real testimonials, taglines, or social proof if present

Treat anything from the current site as canonical. Use the inspiration URLs only for visual layout/aesthetic direction, never for copy or brand voice.

`
    : "";

  const projectBriefBlock = projectBrief
    ? `PROJECT BRIEF — IMPORTANT (functional requirements for this site):
${projectBrief}

Treat this brief as a hard functional requirement that ALL 3 mockups must satisfy. The brief may modify the standard section list — for example, if it describes e-commerce, replace the generic "services" section with a shop section featuring product cards (image, name, price, and a clear Buy Now or Add to Cart button). If it describes booking, include a booking/appointment CTA prominently. If it describes a portfolio or gallery, include the gallery treatment as a primary section. Adapt section names, section content, and CTAs to fit the brief. The 3 concepts may interpret the brief differently in visual treatment, but every mockup must visibly include the features the brief describes.

`
    : "";

  const heroPhotoBlock = hasHeroPhoto
    ? `HERO IMAGE — IMPORTANT:
The user has provided a real client photograph that MUST appear in the hero section of all 3 mockups. Use the literal placeholder string \`${HERO_IMAGE_PLACEHOLDER}\` as the src wherever the hero photo appears. Example:
<img src="${HERO_IMAGE_PLACEHOLDER}" alt="${clientName}" class="..." />
Treat this image as a fixed asset: do NOT swap it for stock photos, do NOT use background-image URLs, do NOT generate alternative imagery for the hero in any of the 3 concepts. The same photo appears in all three. The variation between concepts must come from layout, composition, framing, overlays, gradients, headline treatment — not from changing the photo. Do NOT generate base64 yourself; the server will substitute the real image into every \`${HERO_IMAGE_PLACEHOLDER}\` after you finish.

`
    : "";

  const heroDirectionBlock = heroDirection
    ? `HERO DIRECTION (user's compositional notes for the hero section):
${heroDirection}

Apply this direction to the hero of each concept. The three concepts may interpret it differently (e.g. one literal, one looser), but all must respect the user's intent.

`
    : "";

  const logoBgBlock =
    logoBackground === "either"
      ? ""
      : `LOGO BACKGROUND CONSTRAINT — IMPORTANT:
The client's logo is designed for ${logoBackground === "dark" ? "DARK" : "LIGHT"} backgrounds (its marks are ${logoBackground === "dark" ? "light/white" : "dark"}). In ALL 3 mockups, the header containing the logo MUST use a ${logoBackground === "dark" ? "dark or strongly colored" : "light"} background, OR the logo must sit on a contrasting backing shape, so it remains clearly visible. Never place the logo on a ${logoBackground === "dark" ? "white or light" : "dark"} header where its marks would disappear. This constraint applies to all three concepts without exception.

`;

  return `You are a senior web designer. Analyze the provided inspiration sources and create 3 visually distinct homepage mockups for ${clientName}.

${screenshotBlock}${currentSiteBlock}${urlLine}
Brand colors: ${colorLine}

LOGO IMAGE — IMPORTANT:
Wherever you want the client's logo to appear (typically in the header), use the literal placeholder string \`${LOGO_PLACEHOLDER}\` as the src value. Example:
<img src="${LOGO_PLACEHOLDER}" alt="${clientName} logo" class="h-14 w-auto md:h-16" />
Make the header logo visually prominent — roughly 56–72px tall on desktop (Tailwind h-14 to h-18, or larger if the design calls for it). Avoid sizes smaller than h-12 in the header; a tiny logo reads as unfinished. Always pair height with \`w-auto\` so the aspect ratio is preserved. Footer or inline mentions can be smaller.
Do NOT generate a base64 or data URL yourself. The server will substitute the real logo into every occurrence of \`${LOGO_PLACEHOLDER}\` after you finish.

${projectBriefBlock}${heroPhotoBlock}${heroDirectionBlock}${logoBgBlock}For each of the 3 mockups:
- Make it a complete standalone HTML file
- Include the mobile viewport tag in <head>: <meta name="viewport" content="width=device-width, initial-scale=1">
- Use Tailwind CSS via CDN
- Include: header with logo, hero section, services or features section, testimonials or social proof, CTA section, footer
- Each of the 3 must have a distinctly different layout, typography feel, and visual approach
- Use real-looking placeholder content relevant to ${clientName}, not lorem ipsum
- Make them production-quality, not wireframes
- Fully responsive — design mobile-first, then layer up. Use Tailwind responsive prefixes (sm:, md:, lg:) on layout, typography, spacing, and any multi-column grids. The mockup must read cleanly at 375px (phone), 768px (tablet), and 1280px+ (desktop). No horizontal scroll on mobile. Stack columns on small screens. Hero typography should scale down for small screens (e.g. text-4xl sm:text-5xl lg:text-6xl).

MOBILE HEADER REQUIREMENT — STRICT:
Every mockup must include a mobile header below the md breakpoint with:
- The header logo constrained on mobile (for example max-h-12 and max-w-[220px], with w-auto and object-contain) so it never pushes the menu off-screen at 375px.
- A hamburger icon button with three horizontal lines. Do NOT use a text-only "Menu" pill as the mobile nav control.
- Desktop nav hidden on mobile (hidden md:flex or equivalent) and the mobile hamburger hidden on md+.
- A real collapsible mobile nav panel/dropdown controlled by minimal inline JavaScript in the standalone HTML. The hamburger must toggle the nav open/closed; do not ship a nonfunctional decorative button.
- Header content must fit at 375px without clipping, overlap, or horizontal scrolling.

MOBILE FIT REQUIREMENT — STRICT:
At 375px width, no text, logo, cards, buttons, images, pills, badges, or decorative elements may overflow horizontally. Avoid oversized badges and long single-line labels on mobile. Use wrapping, smaller text, max-width constraints, overflow-hidden where appropriate, and stacked layouts. Buttons should fit their containers with readable labels; long CTA rows must stack vertically on mobile.

INSPIRATION AUDIT — INTERNAL REASONING ONLY:
Before designing, internally analyze each inspiration source — URL${screenshotCount > 0 ? " or screenshot" : ""} — across these dimensions. Do NOT write the audit in your response; keep it as silent reasoning that informs the HTML you generate.
${hasUrls ? `For each URL, use the ${sourceToolName} tool to inspect it and reason from text/HTML/CSS. ` : ""}${screenshotCount > 0 ? "For each screenshot above, perceive the rendered visuals directly — the screenshots are your strongest signal. " : ""}Dimensions to consider:
- **Color palette**: specific hex codes${screenshotCount > 0 ? " (estimate from the screenshots; for URLs, extract from CSS or inline styles)" : " (extract from CSS, inline styles, computed values, or background colors)"}. Distinguish primary, accent, surface, and foreground.
- **Typography**: heading font family + fallback stack, body font family, weights, type-scale character.
- **Photography / imagery style**: ${screenshotCount > 0 ? "from screenshots: moody/clinical, warm/lifestyle, editorial, etc., plus dominant subjects. From URLs: infer from <img>, alt, filenames." : "from <img> tags, alt text, src filenames, and copy — infer the imagery vibe and dominant subjects."}
- **Layout DNA**: hero treatment, grid choices, density, distinctive visual moves.
- **Overall aesthetic vibe**: 3-5 words (e.g. "moody clinical luxury").

Each of the 3 mockups MUST visibly reflect signals from this internal audit — palette echoes, typography feel, photography mood, distinctive layout moves. Do NOT produce a generic "tasteful agency" design. If the inspiration is dark and dramatic, at least one mockup must lean dark and dramatic. The 3 should be three distinct interpretations OF the inspirations, not generic alternatives ignoring them.

${screenshotCount > 0 ? "NOTE: The screenshots are your richest input — you can actually see them. Treat them as the primary visual reference. URLs supplement with text/copy/structure." : `NOTE: ${sourceToolName} returns text/HTML/search context, not pixels. Read filenames, alt text, CSS background-image URLs, and declared color/typography to ground the audit.`}

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

function extractOpenAIText(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    throw new Error("OpenAI response was not an object");
  }
  const response = value as {
    output_text?: unknown;
    output?: unknown;
    error?: unknown;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts: string[] = [];
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (typeof item !== "object" || item === null) continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (typeof block !== "object" || block === null) continue;
        const b = block as { type?: unknown; text?: unknown };
        if (b.type === "output_text" && typeof b.text === "string") {
          parts.push(b.text);
        }
      }
    }
  }

  const text = parts.join("\n").trim();
  if (!text) throw new Error("OpenAI returned no text content");
  return text;
}

function parseMockupsFromText(text: string): {
  mockups: Mockup[];
  parseSource: "markdown" | "json";
} {
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
  return { mockups: rawMockups, parseSource };
}

function injectUploadedAssets(
  rawMockups: Mockup[],
  logoDataUrl: string,
  heroPhotoStr: string | null,
) {
  return rawMockups.map((m) => {
    let html = m.html.split(LOGO_PLACEHOLDER).join(logoDataUrl);
    if (heroPhotoStr) {
      html = html.split(HERO_IMAGE_PLACEHOLDER).join(heroPhotoStr);
    }
    return { name: m.name, html };
  });
}

function getPlaceholderCounts(rawMockups: Mockup[]) {
  return {
    logo: rawMockups.map(
      (m) => m.html.split(LOGO_PLACEHOLDER).length - 1,
    ),
    hero: rawMockups.map(
      (m) => m.html.split(HERO_IMAGE_PLACEHOLDER).length - 1,
    ),
  };
}

async function generateWithOpenAI(args: {
  apiKey: string;
  prompt: string;
  parsedScreenshots: ParsedScreenshot[];
  startedAt: number;
}) {
  const { apiKey, prompt, parsedScreenshots, startedAt } = args;
  const model = process.env.OPENAI_MOCKUP_MODEL || DEFAULT_OPENAI_MODEL;

  const content = [
    ...parsedScreenshots.map((s) => ({
      type: "input_image",
      image_url: `data:${s.mediaType};base64,${s.base64}`,
      detail: "high",
    })),
    { type: "input_text", text: prompt },
  ];

  console.log(
    `[generate] calling OpenAI (model=${model}, reasoning=medium, max_output_tokens=48000, web_search max_tool_calls=8)…`,
  );
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: 48000,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search", search_context_size: "medium" }],
      max_tool_calls: 8,
      store: false,
    }),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      typeof (json as { error?: { message?: unknown } }).error?.message ===
        "string"
        ? (json as { error: { message: string } }).error.message
        : `OpenAI API error (${res.status})`;
    throw new Error(message);
  }

  console.log("[generate] OpenAI responded", {
    elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
  });

  return extractOpenAIText(json);
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON");
  }

  const {
    urls,
    currentSite,
    logoDataUrl,
    brandColor,
    clientName,
    screenshots,
    heroPhotoDataUrl,
    heroDirection,
    logoBackground,
    generationProvider,
  } = body;

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

  let heroPhotoStr: string | null = null;
  if (
    heroPhotoDataUrl !== undefined &&
    heroPhotoDataUrl !== null &&
    heroPhotoDataUrl !== ""
  ) {
    if (
      typeof heroPhotoDataUrl !== "string" ||
      !heroPhotoDataUrl.startsWith("data:image/")
    ) {
      return badRequest("Hero photo must be an image data URL");
    }
    if (heroPhotoDataUrl.length > MAX_HERO_PHOTO_BASE64_BYTES) {
      return badRequest("Hero photo is over 5MB");
    }
    heroPhotoStr = heroPhotoDataUrl;
  }

  const heroDirectionStr =
    typeof heroDirection === "string" ? heroDirection.trim() : "";
  const projectBriefStr =
    typeof body.projectBrief === "string" ? body.projectBrief.trim() : "";
  const logoBgStr: LogoBackground =
    logoBackground === "light" || logoBackground === "dark"
      ? logoBackground
      : "either";
  const provider: GenerationProvider =
    generationProvider === "anthropic" ? "anthropic" : "openai";

  const parsedScreenshots: ParsedScreenshot[] = [];
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

  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          provider === "openai"
            ? "Server is missing OPENAI_API_KEY"
            : "Server is missing ANTHROPIC_API_KEY",
      },
      { status: 500 },
    );
  }

  const prompt = buildPrompt({
    urls: cleanedUrls,
    currentSite: currentSiteStr,
    brandColor: colorStr,
    clientName: clientName.trim(),
    screenshotCount: parsedScreenshots.length,
    hasHeroPhoto: heroPhotoStr !== null,
    heroDirection: heroDirectionStr,
    logoBackground: logoBgStr,
    generationProvider: provider,
    projectBrief: projectBriefStr,
  });

  const client = provider === "anthropic" ? new Anthropic({ apiKey }) : null;

  const startedAt = Date.now();
  console.log("[generate] request received", {
    provider,
    clientName: clientName.trim(),
    inspirationUrls: cleanedUrls.length,
    screenshotCount: parsedScreenshots.length,
    currentSite: currentSiteStr.trim() || null,
    logoBytes: logoDataUrl.length,
    heroPhotoBytes: heroPhotoStr?.length ?? 0,
    heroDirectionChars: heroDirectionStr.length,
    logoBackground: logoBgStr,
    projectBriefChars: projectBriefStr.length,
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
    let text: string;
    if (provider === "openai") {
      text = await generateWithOpenAI({
        apiKey,
        prompt,
        parsedScreenshots,
        startedAt,
      });
    } else {
      if (!client) throw new Error("Anthropic client was not initialized");
      console.log(`[generate] streaming Claude (model=${DEFAULT_ANTHROPIC_MODEL}, max_tokens=48000, web_fetch max_uses=8, max_content_tokens=12000)…`);
      const stream = client.beta.messages.stream({
        model: DEFAULT_ANTHROPIC_MODEL,
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

      text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!text) {
        throw new Error("Model returned no text content");
      }
    }

    // Primary path: Markdown-fenced output (current prompt format).
    // Fallback: legacy JSON output (in case the model reverts to it).
    const { mockups: rawMockups, parseSource } = parseMockupsFromText(text);
    const mockups = injectUploadedAssets(rawMockups, logoDataUrl, heroPhotoStr);
    const placeholderHits = getPlaceholderCounts(rawMockups);

    const totalHtmlChars = mockups.reduce((n, m) => n + m.html.length, 0);
    console.log("[generate] success", {
      provider,
      mockups: mockups.length,
      parseSource,
      placeholderReplacementsPerMockup: placeholderHits.logo,
      heroPlaceholderReplacementsPerMockup: placeholderHits.hero,
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
