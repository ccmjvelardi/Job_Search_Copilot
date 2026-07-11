import { env } from "@/lib/env";
import type { AdzunaCountryCode, JobSearchResult } from "@/types/jobSearch";

interface AdzunaApiResult {
  id: number | string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  created?: string;
}

interface SearchAdzunaParams {
  keywords: string;
  location?: string;
  country?: AdzunaCountryCode;
  page?: number;
}

export async function searchAdzunaJobs({
  keywords,
  location,
  country = "us",
  page = 1,
}: SearchAdzunaParams): Promise<JobSearchResult[]> {
  const params = new URLSearchParams({
    app_id: env.adzunaAppId,
    app_key: env.adzunaAppKey,
    what: keywords,
    results_per_page: "20",
    "content-type": "application/json",
  });
  if (location) {
    params.set("where", location);
  }

  const res = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Adzuna search failed (${res.status})`);
  }

  const data: { results?: AdzunaApiResult[] } = await res.json();

  return (data.results ?? []).map((r) => ({
    id: String(r.id),
    title: r.title,
    company: r.company?.display_name ?? "Unknown company",
    location: r.location?.display_name ?? "",
    description: r.description ?? "",
    url: r.redirect_url,
    salaryMin: r.salary_min ?? null,
    salaryMax: r.salary_max ?? null,
    created: r.created ?? null,
  }));
}
