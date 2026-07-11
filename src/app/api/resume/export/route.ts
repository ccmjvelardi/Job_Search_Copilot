import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildResumeDocx, buildResumePdf } from "@/lib/resumeExport";

const CONTENT_TYPES: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

function safeFilename(name: string | undefined | null): string {
  const base = (name ?? "resume").trim().replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "-");
  return base || "resume";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  const format = searchParams.get("format");

  if (!versionId || !format || !(format in CONTENT_TYPES)) {
    return NextResponse.json(
      { error: "versionId and a valid format (txt, docx, pdf) are required" },
      { status: 400 },
    );
  }

  const { data: version, error: fetchError } = await supabase
    .from("resume_versions")
    .select("structured, rendered_text")
    .eq("id", versionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !version) {
    return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
  }

  const filename = safeFilename(version.structured?.fullName) + "-resume." + format;
  let body: Buffer | Uint8Array | string;

  try {
    if (format === "txt") {
      body = version.rendered_text;
    } else if (format === "docx") {
      body = await buildResumeDocx(version.structured);
    } else {
      body = await buildResumePdf(version.structured);
    }
  } catch {
    return NextResponse.json({ error: "Could not generate that file format" }, { status: 500 });
  }

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
