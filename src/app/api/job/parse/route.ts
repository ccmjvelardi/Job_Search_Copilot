import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claudeJson } from "@/lib/anthropic";
import { jobPostingParseSchema } from "@/lib/schemas";

const SYSTEM_PROMPT = `Extract structured details from a pasted job posting. Call the record_job_details tool with the result. "keyRequirements" should be the 4-8 most important skills/qualifications the posting asks for.`;

function buildLinkedinSearchUrl(company: string): string {
  const query = `${company} recruiter OR "talent acquisition" OR "people team"`;
  const params = new URLSearchParams({ keywords: query });
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { postingText, resumeId } = await request.json();
  if (!postingText || typeof postingText !== "string") {
    return NextResponse.json({ error: "postingText is required" }, { status: 400 });
  }

  let parsed: { company: string; role: string; location?: string | null; keyRequirements: string[] };
  try {
    parsed = await claudeJson({
      system: SYSTEM_PROMPT,
      prompt: postingText,
      toolName: "record_job_details",
      toolDescription: "Records the extracted job posting details.",
      schema: jobPostingParseSchema,
      maxTokens: 1024,
    });
  } catch {
    return NextResponse.json({ error: "Could not extract job details from that posting" }, { status: 502 });
  }

  const linkedinSearchUrl = buildLinkedinSearchUrl(parsed.company);

  const { data: jobTarget, error: insertError } = await supabase
    .from("job_targets")
    .insert({
      user_id: user.id,
      resume_id: resumeId ?? null,
      company: parsed.company,
      role: parsed.role,
      location: parsed.location ?? null,
      raw_posting_text: postingText,
      key_requirements: parsed.keyRequirements,
      linkedin_search_url: linkedinSearchUrl,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    jobTargetId: jobTarget.id,
    company: parsed.company,
    role: parsed.role,
    location: parsed.location,
    keyRequirements: parsed.keyRequirements,
    linkedinSearchUrl,
  });
}
