import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { ResumeCopilot } from "@/components/ResumeCopilot";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Job Search Copilot</h1>
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <ResumeCopilot />
      </main>
    </div>
  );
}
