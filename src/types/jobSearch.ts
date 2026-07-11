export const ADZUNA_COUNTRIES = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "in", label: "India" },
  { code: "br", label: "Brazil" },
  { code: "nl", label: "Netherlands" },
  { code: "sg", label: "Singapore" },
  { code: "za", label: "South Africa" },
  { code: "nz", label: "New Zealand" },
  { code: "mx", label: "Mexico" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "pl", label: "Poland" },
  { code: "at", label: "Austria" },
  { code: "be", label: "Belgium" },
  { code: "ch", label: "Switzerland" },
] as const;

export type AdzunaCountryCode = (typeof ADZUNA_COUNTRIES)[number]["code"];

export interface JobSearchResult {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  created?: string | null;
}
