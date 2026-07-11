export interface WorkHistoryEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  credential: string;
  field?: string;
  graduationDate?: string;
}

export interface StructuredResume {
  fullName?: string;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  summary?: string;
  workHistory: WorkHistoryEntry[];
  skills: string[];
  education: EducationEntry[];
  awards: string[];
  careerNarrative: string;
}

export interface ResumeAnalysis {
  structured: StructuredResume;
  isPolished: boolean;
  polishIssues: string[];
  clarifyingQuestions: string[];
}

export interface ToneFlag {
  phrase: string;
  reason: string;
  suggestion: string;
}

export interface ToneCheckResult {
  humanScore: number;
  flags: ToneFlag[];
  summary: string;
}

export interface JobPostingInsights {
  company: string;
  role: string;
  location?: string;
  keyRequirements: string[];
  linkedinSearchUrl: string;
}
