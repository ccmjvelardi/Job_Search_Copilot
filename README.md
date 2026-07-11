# Job Search Copilot

Upload a resume, get a read on your career history, tell it what job you're
targeting, and get a tailored resume back — plus a nudge to make sure it
still sounds like a human wrote it, and a link to find a recruiter to
network with.

## How it works

1. **Upload** a resume (PDF/DOCX/TXT) or paste the text.
2. Claude extracts a structured resume (work history, skills, education,
   awards) and a career narrative, and flags whether it's detailed enough
   to tailor confidently. If not, it asks clarifying questions.
3. You either **search real openings** (via the Adzuna job search API) or
   paste a job posting yourself.
4. Claude rewrites the resume favorably for that job (no fabricated facts —
   only truthful reframing/emphasis) and the app generates a pre-filled
   LinkedIn search link to find a recruiter/talent-acquisition contact at
   that company.
5. A tone check flags any AI-sounding boilerplate phrases before you send
   the resume out, with a human-likeness score and suggestions.

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
- `src/app/api/resume/tailor` — Claude: rewrite resume for a target job
- `src/app/api/resume/tone-check` — Claude: flags AI-sounding phrasing
- `src/app/api/job/parse` — Claude: extract company/role, build LinkedIn link
- `src/app/api/job/search` — Adzuna job search across ~19 countries
- `src/components/ResumeCopilot.tsx` — the guided UI flow
- `supabase/schema.sql` — DB schema + RLS policies + storage bucket
