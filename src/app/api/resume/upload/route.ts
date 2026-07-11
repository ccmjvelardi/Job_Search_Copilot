import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseResumeFile } from "@/lib/resumeParsing";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const pastedText = formData.get("text");

  let rawText: string;
  let sourceFilename: string | null = null;

  if (file instanceof File) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    try {
      rawText = await parseResumeFile(file);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not parse file" },
        { status: 400 },
      );
    }

    const storagePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, file, { contentType: file.type || undefined });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    sourceFilename = file.name;
  } else if (typeof pastedText === "string") {
    rawText = pastedText.trim();
  } else {
    return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
  }

  if (!rawText || rawText.length < 40) {
    return NextResponse.json(
      { error: "Couldn't find enough resume text. Try uploading a different file or pasting more detail." },
      { status: 400 },
    );
  }

  const { data: resume, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      source_filename: sourceFilename,
      raw_text: rawText,
    })
    .select("id, raw_text")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ resumeId: resume.id, rawText: resume.raw_text });
}
