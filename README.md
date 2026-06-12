# 💸 Rate My Pricing

> How confusing is that pricing page? Paste a URL, an AI agent reads it, and hands out two scores — like Lighthouse, but for pricing pages.

Rate My Pricing is a playful, full‑stack demo built on **[Neon](https://neon.com)** and **[Vercel](https://vercel.com)**:

- A **Next.js** app on Vercel renders a leaderboard and per‑page report cards.
- A long‑running **Neon Function** (Hono) runs the agent, parses the pricing tree, and scores it.
- **Neon Postgres** caches every rating so repeat visits are instant.
- The agent calls an LLM through the **Neon AI Gateway** — one credential, no extra provider keys.

## How it works

```
  user ──▶ Next.js (Vercel) ──▶ Neon Function (Hono agent) ──▶ Neon Postgres (cache)
                                       │
                                       └─▶ Neon AI Gateway (LLM)
```

1. You submit a pricing page URL.
2. If a fresh rating exists in Postgres (< 1 day old), it's served straight from cache.
3. Otherwise the agent **curls the page** — preferring `markdown` (via `Accept: text/markdown` or a `.md` URL), falling back to stripped HTML.
4. The LLM extracts a **standardized pricing tree**: tiers, limits, features, add‑ons, and hidden‑cost signals.
5. Two scores are computed from the tree by pure, deterministic functions (see [Scoring](#scoring)).
6. Hit `100 / 100` and you get confetti. 🎉

## Scoring

Both scores are a transparent **points system**: every page starts at **100**, and each kind of complexity subtracts a fixed number of points. The exact line items are shown on every rating page under "How we scored it", and computed in [`api/src/lib/score.ts`](api/src/lib/score.ts).

### 🧾 Pricing clarity — how easy the pricing is to understand

| Rule | Points |
| --- | --- |
| Base score | `100` |
| Each plan beyond the first | `−6` each (max `−30`) |
| Usage‑based or hybrid billing | `−15` |
| Each add‑on / extra package | `−4` each (max `−16`) |
| Each hidden‑cost signal ("watch out") | `−6` each (max `−24`) |
| Real price needs a sales call / calculator | `−10` |
| **No public pricing shown at all** | fixed `−90` (→ score `10`) |

Plain feature lists are **not** penalized — only structural complexity (plans, add‑ons, metered/usage billing, sales‑gating) is. A single clear flat plan scores `100`.

### 🤖 Agent easiness — how easy the page was for the agent to read

| Rule | Points |
| --- | --- |
| Base score | `100` |
| Read from raw HTML (no markdown available) | `−15` |
| No concrete pricing to parse | `−40` |
| Pricing gated behind interaction | `−20` |
| **Couldn't fetch the page at all** | fixed `−100` (→ score `0`) |

Scores are clamped to `0–100`.

Every rated page is permanently available at `rate-my-pricing/<slug>` and served from the cache.

## Project structure

```
rate-my-pricing/
├── api/        # Neon Function — Hono API + agent (fetch → parse → score → cache)
│   ├── neon.ts            # declares the function + AI Gateway
│   ├── src/index.ts       # Hono routes: /rate, /ratings, /ratings/:slug
│   └── src/lib/           # functional core: fetch, parse, score, slug
└── web/        # Next.js app on Vercel — leaderboard, report cards, theme
```

## Local development

### API (Neon Function)

```bash
cd api
bun install
neonctl link            # link your Neon project (us-east-2, preview features)
neonctl deploy          # provision AI Gateway + deploy the function
bun run db:push         # apply the Drizzle schema
neonctl dev             # run locally with injected env
```

### Web (Next.js)

```bash
cd web
bun install
echo "NEXT_PUBLIC_API_URL=<your-function-invocation-url>" > .env.local
bun run dev
```

## Tech

- Neon Postgres · Neon Functions · Neon AI Gateway (preview, `us-east-2`)
- Hono · Drizzle ORM · Vercel AI SDK
- Next.js 15 (App Router) · React 19 · Tailwind CSS v4

Made for fun. Not affiliated with any rated site.
