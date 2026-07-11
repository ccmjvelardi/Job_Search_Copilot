import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { JobPostingInsights, ResumeAnalysis, ToneCheckResult } from "@/types/resume";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, structured, is_polished, polish_issues, clarifying_questions")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resume || !resume.structured?.careerNarrative) {
    return NextResponse.json({ resumeId: null });
  }

  const analysis: ResumeAnalysis = {
    structured: resume.structured,
    isPolished: resume.is_polished,
    polishIssues: resume.polish_issues ?? [],
    clarifyingQuestions: resume.clarifying_questions ?? [],
  };

  const { data: version } = await supabase
    .from("resume_versions")
    .select("id, rendered_text, tone_check, job_target_id")
    .eq("resume_id", resume.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let jobTarget: {
    id: string;
    company: string;
    role: string;
    location: string | null;
    key_requirements: string[];
    linkedin_search_url: string;
    raw_posting_text: string | null;
  } | null = null;

  if (version?.job_target_id) {
    const { data } = await supabase
      .from("job_targets")
      .select("id, company, role, location, key_requirements, linkedin_search_url, raw_posting_text")
      .eq("id", version.job_target_id)
      .maybeSingle();
    jobTarget = data;
  } else {
    const { data } = await supabase
      .from("job_targets")
      .select("id, company, role, location, key_requirements, linkedin_search_url, raw_posting_text")
      .eq("resume_id", resume.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobTarget = data;
  }

  const jobInsights: (JobPostingInsights & { jobTargetId: string }) | null = jobTarget
    ? {
        jobTargetId: jobTarget.id,
        company: jobTarget.company,
        role: jobTarget.role,
        location: jobTarget.location ?? undefined,
        keyRequirements: jobTarget.key_requirements ?? [],
        linkedinSearchUrl: jobTarget.linkedin_search_url,
      }
    : null;

  return NextResponse.json({
    resumeId: resume.id,
    analysis,
    jobText: jobTarget?.raw_posting_text ?? "",
    jobInsights,
    tailored: version ? { versionId: version.id, renderedText: version.rendered_text } : null,
    toneCheck: (version?.tone_check as ToneCheckResult | null) ?? null,
  });
}
