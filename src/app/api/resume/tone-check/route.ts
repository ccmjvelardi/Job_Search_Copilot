import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claudeJson } from "@/lib/anthropic";
import { toneCheckSchema } from "@/lib/schemas";
import type { ToneCheckResult } from "@/types/resume";

const SYSTEM_PROMPT = `You are helping a job seeker sanity-check that their AI-tailored resume still sounds like a real, specific human being wrote it, not a generic AI-generated resume.

Review the resume text for:
- Generic AI-sounding filler phrases ("results-driven professional", "proven track record", "dynamic team player", "leverage synergies", etc.)
- Overly uniform sentence structure/rhythm across bullets
- Vague claims that aren't grounded in a specific, concrete detail
- Anything that reads as a template rather than this specific person's experience

For each issue found, quote the exact "phrase" from the resume, explain "reason" it reads as AI-generated/generic, and give a concrete "suggestion" for making it sound more human and specific.

Also give a "humanScore" from 0-100 (100 = clearly authentic and human-sounding, 0 = obviously AI-generated boilerplate) and a 1-2 sentence "summary" with your overall take and a nudge to the user that they should personalize any flagged spots before sending this out, since hiring managers and AI-detection-savvy recruiters do notice generic resumes.

Call the record_tone_check tool with the result.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { versionId, resumeText } = await request.json();

  let textToCheck: string | undefined = resumeText;

  if (!textToCheck && versionId) {
    const { data: version, error: fetchError } = await supabase
      .from("resume_versions")
      .select("id, rendered_text")
      .eq("id", versionId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !version) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    textToCheck = version.rendered_text;
  }

  if (!textToCheck) {
    return NextResponse.json(
      { error: "versionId or resumeText is required" },
      { status: 400 },
    );
  }

  let result: ToneCheckResult;
  try {
    result = await claudeJson<ToneCheckResult>({
      system: SYSTEM_PROMPT,
      prompt: textToCheck,
      toolName: "record_tone_check",
      toolDescription: "Records the tone check result.",
      schema: toneCheckSchema,
      maxTokens: 2048,
    });
  } catch {
    return NextResponse.json({ error: "Could not run the tone check" }, { status: 502 });
  }

  if (versionId) {
    await supabase
      .from("resume_versions")
      .update({ tone_check: result })
      .eq("id", versionId)
      .eq("user_id", user.id);
  }

  return NextResponse.json(result);
}
