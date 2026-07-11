@AGENTS.md

## Stack

- Next.js 16 (App Router, `src/` layout, Turbopack) + TypeScript + Tailwind
- Supabase: auth (email/password), Postgres (`supabase/schema.sql`), storage bucket `resumes`
- Anthropic Claude (`src/lib/anthropic.ts`, model constant `CLAUDE_MODEL`) — powers resume analysis, tailoring, tone check, job-posting parsing
- Adzuna API (`src/lib/adzuna.ts`) — job search across ~19 countries

Required env vars (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`,
`ADZUNA_APP_KEY`.

## Gotchas hit while building this (avoid re-discovering the hard way)

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`**, and the exported
  function is `proxy`, not `middleware`. See `src/proxy.ts`. This project's
  Next.js version has other breaking changes from training data too —
  check `node_modules/next/dist/docs/` before assuming an API/convention.
- **`NEXT_PUBLIC_*` env vars must be accessed as static `process.env.X`
  member expressions**, never `process.env[name]` with a dynamic key —
  the bundler only inlines the static form into the client bundle. A
  dynamic lookup silently resolves to `undefined` in the browser with no
  build error. See `src/lib/env.ts`.
- **Claude sometimes emits the literal word `undefined` in JSON
  responses** (invalid JSON — only `null` is valid) when a prompt uses
  TypeScript-style `field: string | undefined` type hints. Prompts must
  say "optional, use null, never the word undefined" explicitly.
  `extractJson()` in `src/lib/anthropic.ts` also regex-sanitizes
  `: undefined` → `: null` as a defensive fallback.
- **`supabase/schema.sql` table order matters** — Postgres won't let a
  `create table` reference a FK target that doesn't exist yet. Tables are
  ordered `resumes` → `job_targets` → `resume_versions`. The whole script
  is idempotent (safe to re-run) via `if not exists` / `drop policy if
  exists`.

## Deliberate scope decisions

- **No LinkedIn/Indeed/Glassdoor scraping**, anywhere in this app — ToS
  and legal risk, plus brittleness. Networking contacts use a generated
  LinkedIn people-search URL instead of a real lookup; job search uses the
  legitimate Adzuna API instead of scraping job boards directly.
- **Resume tailoring must never fabricate facts** (employers, titles,
  dates, metrics) — the tailor prompt explicitly forbids this; it may only
  reframe/emphasize what's in the source resume or the user's clarifying
  answers.
- **No client-side flow/session persistence yet** — refreshing the page or
  getting signed out resets the UI to step 1, even though resume/tailor
  data is already saved server-side in Supabase. Known gap, not yet built.
