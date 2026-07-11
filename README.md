# Job Search Copilot

Upload a resume, get a read on your career history, tell it what job you're
targeting, and get a tailored resume back — plus a nudge (with an
interactive fix-it loop) to make sure it still sounds like a human wrote
it, a networking lead, and one-click export when you're ready to send it.

> **Status:** personal project, actively developed. Not yet deployed
> publicly.

## How it works

1. **Upload** a resume (PDF/DOCX/TXT) or paste the text.
2. Claude extracts a structured resume (work history, skills, education,
   awards) and a career narrative, and flags whether it's detailed enough
   to tailor confidently — with clarifying questions if not, which feed
   directly into the tailored rewrite.
3. You either **search real openings** (via the Adzuna job search API) or
   paste a job posting yourself.
4. Claude rewrites the resume favorably for that job (no fabricated facts —
   only truthful reframing/emphasis) and the app generates a pre-filled
   LinkedIn search link to find a recruiter/talent-acquisition contact at
   that company.
5. A tone check flags AI-sounding boilerplate phrases with a human-likeness
   score. Answer its follow-up questions with real specifics (or skip any)
   and it rewrites just those flagged phrases in place — the rest of the
   resume stays untouched.
6. Export the result as **.txt, .docx, or .pdf** whenever you're ready.
7. Every tailored version is saved automatically — a **History** view lets
   you browse and reload any past resume/job combination, and your most
   recent one restores automatically the next time you sign in.

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then in the SQL
editor run [`supabase/schema.sql`](supabase/schema.sql). This creates the
`resumes`, `resume_versions`, and `job_targets` tables (with row-level
security scoped to each user) and a private `resumes` storage bucket for
uploaded files.

Email/password auth is enabled by default in Supabase — no extra config
needed for that.

### 2. Adzuna job search (optional but recommended)

Sign up free at [developer.adzuna.com/signup](https://developer.adzuna.com/signup)
to get an `App ID` and `App Key`. Without these, the "Search for openings"
tab will error, but pasting a job posting manually still works fine.

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=       # Project Settings -> API -> Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Project Settings -> API -> anon public key
ANTHROPIC_API_KEY=              # console.anthropic.com
ADZUNA_APP_ID=                  # developer.adzuna.com/signup
ADZUNA_APP_KEY=                 # developer.adzuna.com/signup
```

### 4. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected
to sign up/sign in, then dropped into the resume flow.

## Notes on the job search feature

Scraping LinkedIn, Indeed, or Glassdoor directly isn't viable (ToS/legal
risk, brittle). Instead the app calls [Adzuna](https://developer.adzuna.com)'s
public job search API, which legitimately aggregates listings across ~19
countries. It's a real, meaningful slice of the market, not the entire
internet — large employers' exclusive listings on LinkedIn/Indeed won't
show up. Other sources (Greenhouse/Lever/Ashby public board feeds, USAJobs
for US federal roles, Remotive/RemoteOK for remote work) are natural
additions if broader coverage is worth the extra integration.

## Notes on the networking-contact feature

Scraping LinkedIn or pulling recruiter contacts from job-board APIs isn't
viable (ToS/legal risk, no public access). For now the app generates a
pre-filled LinkedIn people-search URL (company + "recruiter" / "talent
acquisition") so you can find and reach out to a real contact yourself.
A paid enrichment API (e.g. Hunter.io, Apollo.io) is a natural next step
if this proves valuable enough to justify the cost.

## Project structure

- `src/app/api/resume/upload` — parses PDF/DOCX/TXT, stores raw text
- `src/app/api/resume/analyze` — Claude: structure + polish check
- `src/app/api/resume/tailor` — Claude: rewrite resume for a target job;
  also handles the targeted revision pass after the tone check
- `src/app/api/resume/tone-check` — Claude: flags AI-sounding phrasing
- `src/app/api/resume/export` — generates .txt/.docx/.pdf downloads
- `src/app/api/resume/latest` — restores the user's most recent progress
- `src/app/api/resume/versions` — lists past tailored versions for History
- `src/app/api/job/parse` — Claude: extract company/role, build LinkedIn link
- `src/app/api/job/search` — Adzuna job search across ~19 countries
- `src/components/ResumeCopilot.tsx` — the guided UI flow
- `src/lib/resumeExport.ts` — docx/pdf generation from structured resume data
- `supabase/schema.sql` — DB schema + RLS policies + storage bucket

## License

All rights reserved — see [LICENSE](LICENSE). This repo is public for
portfolio/demonstration purposes; it isn't licensed for reuse.
