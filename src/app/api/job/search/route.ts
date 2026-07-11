import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAdzunaJobs } from "@/lib/adzuna";
import type { AdzunaCountryCode } from "@/types/jobSearch";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { keywords, location, country } = await request.json();

  if (!keywords || typeof keywords !== "string") {
    return NextResponse.json({ error: "keywords is required" }, { status: 400 });
  }

  try {
    const results = await searchAdzunaJobs({
      keywords,
      location: typeof location === "string" ? location : undefined,
      country: typeof country === "string" ? (country as AdzunaCountryCode) : undefined,
    });
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Job search failed" },
      { status: 502 },
    );
  }
}
