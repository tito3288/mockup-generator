import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  html?: unknown;
  clientName?: unknown;
};

type ExportPayload = {
  blueprint: string;
  themeConfig: string;
};

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client"
  );
}

function buildPrompt(args: { clientName: string; html: string }) {
  const { clientName, html } = args;

  return `You are a senior web designer preparing a hand-off package for an AI coding agent that will rebuild the design as a real Astro project for ${clientName}.

You are given the final HTML mockup below. Read it carefully and produce two files derived from it.

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{ "blueprint": "...", "themeConfig": "..." }

Each value is the raw file content as a single string. No backticks. No extra commentary.

================
FILE 1 — blueprint
================
A markdown document (will be saved as BLUEPRINT.md). Required sections, in order, each as a level-2 heading except the title:

# ${clientName} — Design Blueprint

## Overall direction & vibe
2–3 sentences capturing the design's mood, audience, and personality.

## Section-by-section breakdown
For each section in the mockup (header, hero, services/features, testimonials/social proof, CTA, footer, plus anything else present), describe layout, content intent, and key visual moves.

## Typography
Font families used (heading and body), sizing approach, weight choices, any notable letter-spacing or line-height treatments.

## Color palette
List every meaningful color with its hex code and role (primary, accent, surface, foreground, muted, etc.).

## Spacing & layout
Container widths, vertical rhythm, grid choices, breakpoints inferred from the markup.

## Unique visual treatments
Anything worth preserving: gradients, glassmorphism, custom shapes, illustration style, motion cues, etc.

Write it so an AI coding agent can recreate the design in Astro + Tailwind without seeing the original HTML.

================
FILE 2 — themeConfig
================
A TypeScript module (will be saved as theme.config.ts). Use this exact shape and fill values extracted from the HTML:

export const theme = {
  colors: {
    primary: "#...",
    secondary: "#...",
    accent: "#...",
    background: "#...",
    foreground: "#...",
    muted: "#...",
  },
  fonts: {
    heading: "...",
    body: "...",
  },
  radius: {
    sm: "...",
    md: "...",
    lg: "...",
  },
} as const;

export type Theme = typeof theme;

Use real hex values you can read from the HTML (or sensibly infer from Tailwind classes used). Use real CSS font-family stacks. Use rem or px values for radius (e.g., "0.5rem"). Do NOT add comments. Do NOT add fields beyond the shape above.

================
HTML MOCKUP
================
${html}
`;
}

function buildKickoffMd(clientName: string, clientSlug: string): string {
  return `# Build the ${clientName} Astro site — Phase 1 (Scaffold)

You are Claude Code running in a terminal. **This prompt only handles the project scaffold.** The homepage build happens later in a separate prompt (\`BUILD_PROMPT.md\`) once the design files are in the workspace.

## What to do

Scaffold a fresh Astro project in a new subfolder named \`${clientSlug}\` (relative to the current working directory). Use the Astro CLI **non-interactively** so the install does not stall on prompts:

\`\`\`bash
npm create astro@latest ${clientSlug} -- --template minimal --typescript strict --install --no-git --skip-houston --yes
\`\`\`

Then add the required integrations, also non-interactively:

\`\`\`bash
cd ${clientSlug}
npx astro add tailwind --yes
npx astro add mdx --yes
npx astro add cloudflare --yes
\`\`\`

Verify the dev server boots cleanly:

\`\`\`bash
npm run dev
\`\`\`

Stop the server after ~5 seconds. If anything errored, fix it and try again. Then report done.

## What NOT to do

- Do **NOT** build the homepage yet.
- Do **NOT** modify \`tailwind.config.ts\` beyond what \`astro add tailwind\` produces.
- Do **NOT** add additional dependencies.

## Hand-off back to the user

When the scaffold is verified, tell the user to:

1. Move \`BLUEPRINT.md\`, \`theme.config.ts\`, \`design/\`, and \`BUILD_PROMPT.md\` into the new \`${clientSlug}/\` folder (alongside \`src/\`, \`public/\`, etc.).
2. Open \`${clientSlug}/\` in Cursor.
3. Use the Claude Code extension and paste the contents of \`BUILD_PROMPT.md\` to continue with Phase 2.
`;
}

function buildBuildPromptMd(clientName: string, clientSlug: string): string {
  return `# Build the ${clientName} homepage — Phase 2 (Design)

You are Claude Code running inside Cursor. The scaffolded Astro project for **${clientName}** is open as the workspace, and the design hand-off files are already in this workspace.

## Source of truth (already in this workspace)

- \`design/index.html\` — the rendered homepage mockup
- \`BLUEPRINT.md\` — design intent: vibe, sections, typography, palette, spacing, unique treatments
- \`theme.config.ts\` — extracted theme tokens (colors, fonts, radius)

Read all three before writing any code.

## What to do

1. **Wire the theme tokens into Tailwind.** Import \`theme.config.ts\` into \`tailwind.config.ts\` and drive the theme (colors, fonts, radius) from it. No hard-coded hex values in components.
2. **Recreate the homepage** as accessible Astro components, section by section, faithful to \`design/index.html\` and \`BLUEPRINT.md\`. Break the page into reusable \`.astro\` components under \`src/components/\`.
3. **Real placeholder content** relevant to ${clientName} — never lorem ipsum. If you need more copy than the mockup provides, write plausible new content in the same voice.
4. **Fully responsive** (mobile, tablet, desktop). Mobile-first. The viewport meta tag is already in Astro's default layout — confirm it.
5. **Accessibility** — semantic HTML, descriptive alt text, keyboard navigation, sufficient color contrast.
6. **SEO-ready** — \`<title>\`, meta description, Open Graph tags, canonical URL.
7. **Verify** — run \`npx astro check\` and \`npx astro build\`. Fix any errors before reporting done.

## Hand-off back to the user

When done, summarize what was built section by section, and note any decisions you made (e.g. invented copy, breakpoints not present in the mockup, components extracted).

The slugified project name is \`${clientSlug}\`.
`;
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

function validatePayload(value: unknown): ExportPayload {
  if (typeof value !== "object" || value === null) {
    throw new Error("Model response was not an object");
  }
  const v = value as Record<string, unknown>;
  const blueprint = v.blueprint;
  const themeConfig = v.themeConfig;

  if (typeof blueprint !== "string" || blueprint.length < 200) {
    throw new Error("blueprint missing or too short");
  }
  if (!/^#\s|\n#\s/.test(blueprint)) {
    throw new Error("blueprint missing markdown heading");
  }

  if (typeof themeConfig !== "string") {
    throw new Error("themeConfig missing");
  }
  if (
    !themeConfig.includes("export const theme") ||
    !themeConfig.includes("colors") ||
    !themeConfig.includes("fonts") ||
    !themeConfig.includes("radius")
  ) {
    throw new Error("themeConfig missing required shape");
  }

  return { blueprint, themeConfig };
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON");
  }

  const { html, clientName } = body;

  if (typeof html !== "string" || html.trim().length === 0) {
    return badRequest("Mockup HTML is required");
  }
  if (typeof clientName !== "string" || clientName.trim().length === 0) {
    return badRequest("Client name is required");
  }

  const trimmedClient = clientName.trim();
  const clientSlug = slugify(trimmedClient);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }

  const prompt = buildPrompt({
    clientName: trimmedClient,
    html,
  });

  const client = new Anthropic({ apiKey });

  const startedAt = Date.now();
  console.log("[export] request received", {
    clientName: trimmedClient,
    clientSlug,
    htmlChars: html.length,
    promptChars: prompt.length,
  });

  try {
    console.log(
      "[export] streaming Claude (model=claude-sonnet-4-5, max_tokens=16000)…",
    );
    const stream = client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("connect", () => {
      console.log(
        `[export] connected (+${((Date.now() - startedAt) / 1000).toFixed(1)}s)`,
      );
    });

    let textChars = 0;
    stream.on("text", (delta) => {
      const before = textChars;
      textChars += delta.length;
      if (Math.floor(before / 5000) !== Math.floor(textChars / 5000)) {
        const t = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`[export] +${t}s writing… ${textChars} chars so far`);
      }
    });

    const response = await stream.finalMessage();

    const elapsedMs = Date.now() - startedAt;
    console.log("[export] Claude responded", {
      elapsedSec: (elapsedMs / 1000).toFixed(1),
      stop_reason: response.stop_reason,
      usage: response.usage,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Model returned no text content");
    }

    const parsed = extractJson(text);
    const payload = validatePayload(parsed);

    const kickoff = buildKickoffMd(trimmedClient, clientSlug);
    const buildPromptMd = buildBuildPromptMd(trimmedClient, clientSlug);

    console.log("[export] success", {
      slug: clientSlug,
      blueprintChars: payload.blueprint.length,
      themeConfigChars: payload.themeConfig.length,
      kickoffChars: kickoff.length,
      buildPromptChars: buildPromptMd.length,
      elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
    });

    return NextResponse.json({
      slug: clientSlug,
      blueprint: payload.blueprint,
      themeConfig: payload.themeConfig,
      kickoff,
      buildPrompt: buildPromptMd,
    });
  } catch (err) {
    console.error(
      "[export] failed after",
      ((Date.now() - startedAt) / 1000).toFixed(1),
      "s:",
      err,
    );
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic API error: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
