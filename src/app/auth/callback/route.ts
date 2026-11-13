import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const loginWithError = (message: string) =>
    NextResponse.redirect(`${origin}/login?authError=${encodeURIComponent(message)}`);

  // Supabase redirects here with ?error=... (and no code) when an email link
  // has expired or was already used. Without this check the user would land
  // on `next` (e.g. /reset-password) with no session.
  if (searchParams.get("error") || !code) {
    return loginWithError(
      "That link has expired or was already used. Please request a new one.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginWithError(
      "That link didn't work — it needs to be opened in the same browser you requested it from. Please request a new one.",
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
