"use client";

// Landing page for email links that carry a token_hash (password reset).
// Unlike the PKCE flow in /auth/callback, verifying a token_hash doesn't need
// anything stored in the browser that requested the email, so the link works
// in any browser. The token is only spent when the user clicks the button —
// not on page load — so email scanners that prefetch links can't use it up.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

const EXPIRED_MESSAGE =
  "That link has expired or was already used. Please request a new one.";

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}

function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const [loading, setLoading] = useState(false);

  function goToLoginWithError(message: string) {
    router.replace(`/login?authError=${encodeURIComponent(message)}`);
  }

  async function handleContinue() {
    if (!tokenHash || !type) {
      goToLoginWithError(EXPIRED_MESSAGE);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      goToLoginWithError(EXPIRED_MESSAGE);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const isRecovery = type === "recovery";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isRecovery ? "Reset your password" : "Confirm your email"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isRecovery
            ? "Click below to continue and choose a new password."
            : "Click below to continue."}
        </p>
      </div>
      <button
        type="button"
        onClick={handleContinue}
        disabled={loading}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {loading ? "Please wait…" : "Continue"}
      </button>
    </main>
  );
}
