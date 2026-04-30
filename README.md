# Mockup Generator

A single-page Next.js app that generates three distinct homepage mockups for a client. You provide three inspiration URLs, a logo, an optional brand color, and a client name; the app calls Claude (Sonnet 4.5) with the `web_fetch` server tool so Claude actually reads the inspiration sites before designing. The result is three standalone HTML files (Tailwind via CDN) rendered side-by-side in iframes with per-mockup download buttons.

## Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
# open http://localhost:3000
```

Fill in the form and click **Generate Mockups**. Generation takes 30–60 seconds because Claude fetches each inspiration URL before composing the designs.

## Deploy to Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app), **New Project → Deploy from GitHub**, and pick the repo.
3. Railway auto-detects Next.js — no custom build/start commands needed.
4. In the project's **Variables** tab, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
5. Click **Deploy**. Railway runs `npm run build` then `npm run start`; `PORT` is injected automatically and Next.js binds to it.

## How it works

- `src/app/page.tsx` — client component with the form and results grid. The logo is read in-browser via `FileReader.readAsDataURL` and sent to the API as a data URL.
- `src/app/api/generate/route.ts` — server route that calls `client.beta.messages.create` with the `web_fetch_20250910` tool (beta header `web-fetch-2025-09-10`). The tool runs server-side at Anthropic, so there's no client-side tool loop. The route parses Claude's JSON response and returns the three mockups.

## Notes

- The route sets `maxDuration = 300` to accommodate generations that can take up to a minute.
- Mockups render in iframes with `sandbox="allow-scripts"` so the Tailwind CDN can apply styles, but the iframe origin stays null and can't reach the host page.
- Each generation costs a few cents (Sonnet 4.5 input + output, plus `web_fetch` calls).
