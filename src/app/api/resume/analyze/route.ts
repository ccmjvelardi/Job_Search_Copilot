import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claudeJson } from "@/lib/anthropic";
import { resumeAnalysisSchema } from "@/lib/schemas";
import type { ResumeAnalysis } from "@/types/resume";

const SYSTEM_PROMPT = `You are a career analyst helping a job seeker understand their own resume.

Given raw resume text, do two things:
1. Extract a structured version of the resume (work history, skills, education, awards, contact info) and write a 2-4 sentence "careerNarrative" that gives a general read on the person's career trajectory (what kind of roles, what domain, seniority, trajectory).
2. Judge whether the resume is "polished" enough to confidently tailor toward a specific job. A resume is NOT polished if bullets are vague, lack outcomes/metrics, job scope is unclear, or there isn't enough detail to understand what the person actually did. If it is not polished, list the specific issues, and produce clarifying questions to ask the user. Always include one clarifying question asking what job/role they are targeting, since tailoring requires that.

Call the record_resume_analysis tool with your findings.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { resumeId } = await request.json();
  if (!resumeId) {
    return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
  }

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, raw_text")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  let analysis: ResumeAnalysis;
  try {
    analysis = await claudeJson<ResumeAnalysis>({
      system: SYSTEM_PROMPT,
      prompt: resume.raw_text,
      toolName: "record_resume_analysis",
      toolDescription: "Records the structured resume and polish assessment.",
      schema: resumeAnalysisSchema,
    });
  } catch {
    return NextResponse.json({ error: "Could not analyze this resume" }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from("resumes")
    .update({
      structured: analysis.structured,
      is_polished: analysis.isPolished,
      polish_issues: analysis.polishIssues,
      clarifying_questions: analysis.clarifyingQuestions,
    })
    .eq("id", resumeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(analysis);
}
