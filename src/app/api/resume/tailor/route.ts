import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claudeJson } from "@/lib/anthropic";
import { tailoredResumeSchema } from "@/lib/schemas";
import type { StructuredResume } from "@/types/resume";

const SYSTEM_PROMPT = `You are an expert resume writer helping a job seeker tailor their resume to a specific job.

You will receive the person's existing structured resume, their original raw resume text, the job they're targeting, and (optionally) answers to clarifying questions.

Rewrite the resume to be as favorable and compelling as possible for this specific job:
- Reorder and re-emphasize experience/skills most relevant to the target job.
- Rewrite bullets with strong action verbs and, where the source material supports it, quantified outcomes.
- Mirror relevant keywords/terminology from the job description for ATS matching, without keyword-stuffing.
- Tighten a professional summary aimed squarely at this role.

CRITICAL: Never invent employers, titles, dates, credentials, or metrics that are not supported by the source material or the user's clarifying answers. You may rephrase, emphasize, and infer reasonable scope from what's given, but do not fabricate facts. Favorable framing, not fiction.

REVISION MODE: If you receive a PREVIOUS TAILORED VERSION plus FLAGGED PHRASES TO FIX, your job changes: don't do a fresh rewrite. Start from that previous version and change ONLY the flagged phrases, leaving every other bullet, the summary, ordering, and wording exactly as it was. For each flagged phrase: if a user-provided specific detail is given, weave that real detail in naturally; if none is given, rewrite just that phrase to follow the suggested fix direction without inventing new facts or numbers. The rest of the resume must come back unchanged from the previous version.

Call the record_tailored_resume tool with the result. "renderedText" must be a clean, plain-text resume (no markdown symbols) formatted with clear section headings, ready to copy into a document.`;

interface HumanizationFeedbackItem {
  phrase: string;
  reason: string;
  suggestion: string;
  userAnswer?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    resumeId,
    targetJobDescription,
    clarifyingAnswers,
    jobTargetId,
    baseVersionId,
    humanizationFeedback,
  }: {
    resumeId?: string;
    targetJobDescription?: string;
    clarifyingAnswers?: Record<string, string>;
    jobTargetId?: string;
    baseVersionId?: string;
    humanizationFeedback?: HumanizationFeedbackItem[];
  } = await request.json();

  if (!resumeId || !targetJobDescription) {
    return NextResponse.json(
      { error: "resumeId and targetJobDescription are required" },
      { status: 400 },
    );
  }

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, raw_text, structured")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  let revisionContext: string | null = null;
  if (baseVersionId && humanizationFeedback?.length) {
    const { data: baseVersion, error: baseVersionError } = await supabase
      .from("resume_versions")
      .select("structured, rendered_text")
      .eq("id", baseVersionId)
      .eq("user_id", user.id)
      .single();

    if (baseVersionError || !baseVersion) {
      return NextResponse.json({ error: "Previous resume version not found" }, { status: 404 });
    }

    const feedbackList = humanizationFeedback
      .map((f, i) => {
        const lines = [
          `${i + 1}. Phrase: "${f.phrase}"`,
          `   Why flagged: ${f.reason}`,
          `   Suggested fix direction: ${f.suggestion}`,
          `   User-provided specific detail: ${f.userAnswer?.trim() || "(none provided — apply the suggested fix without inventing new facts/numbers)"}`,
        ];
        return lines.join("\n");
      })
      .join("\n");

    revisionContext = [
      `PREVIOUS TAILORED VERSION (structured):\n${JSON.stringify(baseVersion.structured, null, 2)}`,
      `PREVIOUS TAILORED VERSION (rendered text):\n${baseVersion.rendered_text}`,
      `FLAGGED PHRASES TO FIX:\n${feedbackList}`,
    ].join("\n\n");
  }

  const userPrompt = [
    `TARGET JOB DESCRIPTION:\n${targetJobDescription}`,
    clarifyingAnswers
      ? `CLARIFYING ANSWERS FROM THE USER:\n${JSON.stringify(clarifyingAnswers, null, 2)}`
      : null,
    `EXISTING STRUCTURED RESUME:\n${JSON.stringify(resume.structured, null, 2)}`,
    `ORIGINAL RAW RESUME TEXT:\n${resume.raw_text}`,
    revisionContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  let result: { structured: StructuredResume; renderedText: string };
  try {
    result = await claudeJson({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      toolName: "record_tailored_resume",
      toolDescription: "Records the tailored resume.",
      schema: tailoredResumeSchema,
      maxTokens: 8192,
    });
  } catch {
    return NextResponse.json({ error: "Could not tailor this resume" }, { status: 502 });
  }

  const { data: version, error: insertError } = await supabase
    .from("resume_versions")
    .insert({
      resume_id: resumeId,
      user_id: user.id,
      job_target_id: jobTargetId ?? null,
      structured: result.structured,
      rendered_text: result.renderedText,
    })
    .select("id, structured, rendered_text, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    versionId: version.id,
    structured: version.structured,
    renderedText: version.rendered_text,
  });
}
