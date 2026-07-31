import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const message =
        "That link didn't work — it needs to be opened in the same browser you requested it from. Please request a new one.";
      return NextResponse.redirect(`${origin}/login?authError=${encodeURIComponent(message)}`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
