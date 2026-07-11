function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // NEXT_PUBLIC_* vars must be accessed as static `process.env.X` member
  // expressions (not a dynamic `process.env[name]` lookup) so Next.js can
  // inline them into the client bundle at build time.
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
  },
  get adzunaAppId() {
    return required("ADZUNA_APP_ID", process.env.ADZUNA_APP_ID);
  },
  get adzunaAppKey() {
    return required("ADZUNA_APP_KEY", process.env.ADZUNA_APP_KEY);
  },
};
