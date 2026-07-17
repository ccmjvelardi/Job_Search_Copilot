@AGENTS.md

## Stack

- Next.js 16 (App Router, `src/` layout, Turbopack) + TypeScript + Tailwind
- Supabase: auth (email/password), Postgres (`supabase/schema.sql`), storage bucket `resumes`
- Anthropic Claude (`src/lib/anthropic.ts`, model constant `CLAUDE_MODEL`) — powers resume analysis, tailoring, tone check, job-posting parsing. Uses forced tool-use (`claudeJson()`), not prose-JSON parsing — see Gotchas.
- Adzuna API (`src/lib/adzuna.ts`) — job search across ~19 countries
- `unpdf` (`src/lib/resumeParsing.ts`) — PDF text extraction. Not `pdf-parse` — see Gotchas.
- `docx` + `pdf-lib` (`src/lib/resumeExport.ts`) — generates downloadable .docx/.pdf from a tailored resume

Required env vars (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`,
`ADZUNA_APP_KEY`. These must also be set in the Vercel project's
Environment Variables (Production + Preview) — `NEXT_PUBLIC_*` values get
baked in at **build** time, so a deploy with them missing fails prerendering
`/login` with `Missing required environment variable: ...`, not just at
runtime.

## Deployment

- GitHub: `https://github.com/ccmjvelardi/Job_Search_Copilot.git` (branch `master`)
- Deployed on Vercel, connected to that repo (auto-deploys on push)
- Auth emails currently go out via Supabase's default shared mail sender
  (looks like a Supabase email, low rate limit). White-labeling this needs
  custom SMTP configured in Supabase (Project Settings → Authentication →
  SMTP Settings) pointed at a real provider (Resend recommended) — not yet
  done.
- Repo license: all-rights-reserved (see `LICENSE`) — public for
  portfolio/visibility, not licensed for reuse. Deliberate choice since the
  plan is to eventually open this to other users as a hosted product, not
  as reusable source.

## Gotchas hit while building this (avoid re-discovering the hard way)

- **This dev machine's system `git`, `python3`, and (sometimes) other
  `/usr/bin/*` tools are broken** — Xcode Command Line Tools have an
  architecture mismatch (`libxcrun` x86_64 vs arm64e), so anything routed
  through the system CLT shim fails with an `xcrun` error. Working
  alternates: git is at `/usr/local/bin/git` (v2.21, a standalone 2019
  install); Node/npm need `/opt/anaconda3/bin` prepended to `PATH`
  (`PATH="/opt/anaconda3/bin:$PATH" npm run build`, etc. — the default
  `node` on `PATH` is an ancient v10). This is a host-machine quirk, not a
  project issue — a fresh machine or Vercel's build container won't have it.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`**, and the exported
  function is `proxy`, not `middleware`. See `src/proxy.ts`. This project's
  Next.js version has other breaking changes from training data too —
  check `node_modules/next/dist/docs/` before assuming an API/convention.
- **`NEXT_PUBLIC_*` env vars must be accessed as static `process.env.X`
  member expressions**, never `process.env[name]` with a dynamic key —
  the bundler only inlines the static form into the client bundle. A
  dynamic lookup silently resolves to `undefined` in the browser with no
  build error. See `src/lib/env.ts`.
- **Don't ask Claude to write JSON as prose text and parse it — use forced
  tool-use instead.** The original approach (ask for JSON in a text block,
  regex-sanitize, `JSON.parse`) intermittently failed, including Claude
  emitting the literal word `undefined` in JSON (invalid — only `null` is).
  Fixed by switching every Claude call to `claudeJson()` in
  `src/lib/anthropic.ts`, which forces a tool call against a JSON Schema
  (see `src/lib/schemas.ts`) — the SDK hands back an already-parsed,
  schema-conformant object, no string parsing at all. Any new Claude-backed
  endpoint should use this helper, not raw `messages.create` + text parsing.
- **`pdf-parse` (via `pdfjs-dist`) doesn't work in this serverless
  environment** — it references the browser-only `DOMMatrix` API at module
  load time (`ReferenceError: DOMMatrix is not defined`), and separately
  fails to resolve its worker script under Turbopack's bundling (`Setting
  up fake worker failed`). Both reproduce locally too once actually tested
  with a real PDF (easy to miss — pasted-text testing won't catch it).
  Replaced with `unpdf`, which ships a PDF.js build compiled specifically
  for serverless/edge runtimes. It also requires a plain `Uint8Array`, not
  a Node `Buffer` (`new Uint8Array(buffer)`), even though `Buffer` is
  technically a `Uint8Array` subclass. See `src/lib/resumeParsing.ts`.
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
  answers. The same endpoint has a "revision mode" (`baseVersionId` +
  `humanizationFeedback` params) used by the tone-check fix-it loop — it
  edits only the flagged phrases in place rather than doing a fresh
  rewrite, so unflagged content never drifts.
- **No formatting-preserving export (yet)** — tailored resumes export as
  cleanly generated .txt/.docx/.pdf (`src/lib/resumeExport.ts`), not a
  copy of the user's original uploaded file's exact visual styling.
  Deferred as a separate future workflow; see memory
  `job_search_copilot_resume_template` for the reference design.
- **Progress persistence exists** — `/api/resume/latest` restores the
  user's most recent resume/job/tailored version on load, and
  `/api/resume/versions` powers a History view to browse/reload any past
  tailored version. (Superseded an earlier stale note in this file saying
  this didn't exist yet.)
