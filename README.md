# Mockup Generator

A single-page Next.js app that generates three distinct homepage mockups for a client. You provide inspiration URLs, a logo, optional screenshots, optional hero direction, brand colors, and a client name; the app can call either Anthropic Claude (default) or OpenAI GPT-5.5 to inspect the inspiration sources before designing. The result is three standalone HTML files (Tailwind via CDN) rendered in iframes with per-mockup download and handoff buttons.

## Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
# optional: set OPENAI_API_KEY=sk-... to enable the OpenAI engine
npm run dev
# open http://localhost:3000
```

Fill in the form, choose a generation engine, and click **Generate Mockups**. Generation usually takes 60–120 seconds because the selected model inspects the inspiration sources before composing the designs.

## Deploy to Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app), **New Project → Deploy from GitHub**, and pick the repo.
3. Railway auto-detects Next.js — no custom build/start commands needed.
4. In the project's **Variables** tab, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `OPENAI_API_KEY` = your OpenAI API key (optional, only needed for the OpenAI engine)
   - `OPENAI_MOCKUP_MODEL` = `gpt-5.5` (optional override)
5. Click **Deploy**. Railway runs `npm run build` then `npm run start`; `PORT` is injected automatically and Next.js binds to it.

## How it works

- `src/app/page.tsx` — client component with the form and results grid. The logo, screenshots, and hero photo are read in-browser via `FileReader.readAsDataURL` and sent to the API as data URLs.
- `src/app/api/generate/route.ts` — server route that validates the inputs, builds the shared mockup prompt, and calls the selected provider. Anthropic uses Claude Sonnet 4.5 with the `web_fetch_20250910` tool. OpenAI uses the Responses API with `gpt-5.5`, `reasoning.effort: "medium"`, screenshot image inputs, and the hosted `web_search` tool.
- `src/app/api/export/route.ts` — server route behind **Use This Design**. It creates the AI handoff bundle: `CLAUDE_KICKOFF.md`, `BUILD_PROMPT.md`, `BLUEPRINT.md`, `theme.config.ts`, and `design/index.html`.

## Notes

- The route sets `maxDuration = 300` to accommodate generations that can take a couple of minutes.
- Mockups render in iframes with `sandbox="allow-scripts"` so the Tailwind CDN can apply styles, but the iframe origin stays null and can't reach the host page.
- Each generation has provider costs: model input/output tokens plus any hosted web tool usage.
