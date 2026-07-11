import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ToneCheckResult } from "@/types/resume";

interface JobTargetRow {
  company: string;
  role: string;
  location: string | null;
  key_requirements: string[];
  linkedin_search_url: string;
  raw_posting_text: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("resume_versions")
    .select(
      "id, created_at, rendered_text, resume_id, job_target_id, tone_check, job_targets(company, role, location, key_requirements, linkedin_search_url, raw_posting_text)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const versions = (data ?? []).map((row) => {
    const jobTarget = (Array.isArray(row.job_targets) ? row.job_targets[0] : row.job_targets) as
      | JobTargetRow
      | null;
    return {
      versionId: row.id,
      resumeId: row.resume_id,
      jobTargetId: row.job_target_id,
      createdAt: row.created_at,
      preview: row.rendered_text.slice(0, 160),
      renderedText: row.rendered_text,
      toneCheck: (row.tone_check as ToneCheckResult | null) ?? null,
      company: jobTarget?.company ?? null,
      role: jobTarget?.role ?? null,
      location: jobTarget?.location ?? null,
      keyRequirements: jobTarget?.key_requirements ?? [],
      linkedinSearchUrl: jobTarget?.linkedin_search_url ?? null,
      jobText: jobTarget?.raw_posting_text ?? "",
    };
  });

  return NextResponse.json({ versions });
}
