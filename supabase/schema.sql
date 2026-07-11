-- Run this in the Supabase SQL editor (or via `supabase db push`) for a fresh project.
-- Safe to re-run: every statement is idempotent.

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_filename text,
  raw_text text not null,
  structured jsonb not null default '{}'::jsonb,
  is_polished boolean not null default false,
  polish_issues jsonb not null default '[]'::jsonb,
  clarifying_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.job_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  company text not null,
  role text not null,
  location text,
  raw_posting_text text,
  key_requirements jsonb not null default '[]'::jsonb,
  linkedin_search_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_target_id uuid references public.job_targets (id) on delete set null,
  structured jsonb not null,
  rendered_text text not null,
  tone_check jsonb,
  created_at timestamptz not null default now()
);

alter table public.resumes enable row level security;
alter table public.job_targets enable row level security;
alter table public.resume_versions enable row level security;

drop policy if exists "Users manage their own resumes" on public.resumes;
create policy "Users manage their own resumes" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own job targets" on public.job_targets;
create policy "Users manage their own job targets" on public.job_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own resume versions" on public.resume_versions;
create policy "Users manage their own resume versions" on public.resume_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for the original uploaded resume files (PDF/DOCX).
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own resume files" on storage.objects;
create policy "Users manage their own resume files"
  on storage.objects for all
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
