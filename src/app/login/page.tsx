"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyErrorMessage(message: string) {
  if (!message || message === "{}") {
    return "Too many requests right now — please wait a few minutes and try again.";
  }
  return message;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mode, setMode] = useState<"signIn" | "signUp" | "forgotPassword">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authError = searchParams.get("authError");
    if (authError) {
      setError(authError);
      setMode("forgotPassword");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === "signIn") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.replace("/");
        router.refresh();
      }
    } else if (mode === "signUp") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(friendlyErrorMessage(error.message));
      } else {
        setInfo("Check your email to confirm your account, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setError(friendlyErrorMessage(error.message));
      } else {
        setInfo("Check your email for a link to reset your password.");
      }
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Job Search Copilot</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "signIn" && "Sign in to continue."}
          {mode === "signUp" && "Create an account to get started."}
          {mode === "forgotPassword" && "Enter your email and we'll send you a reset link."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        {mode !== "forgotPassword" && (
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        )}
        {mode === "signIn" && (
          <button
            type="button"
            onClick={() => {
              setMode("forgotPassword");
              setError(null);
              setInfo(null);
            }}
            className="self-end text-xs text-neutral-500 underline underline-offset-2"
          >
            Forgot password?
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading
            ? "Please wait…"
            : mode === "signIn"
              ? "Sign in"
              : mode === "signUp"
                ? "Sign up"
                : "Send reset link"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signUp" ? "signIn" : mode === "forgotPassword" ? "signIn" : "signUp");
          setError(null);
          setInfo(null);
        }}
        className="text-sm text-neutral-500 underline underline-offset-2"
      >
        {mode === "signIn" && "Need an account? Sign up"}
        {mode === "signUp" && "Already have an account? Sign in"}
        {mode === "forgotPassword" && "Back to sign in"}
      </button>
    </main>
  );
}
