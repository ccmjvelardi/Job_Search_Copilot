import type { JsonSchema } from "@/lib/anthropic";

/** Shared JSON schema fragment for the StructuredResume shape. */
export const structuredResumeSchema = {
  type: "object",
  properties: {
    fullName: { type: ["string", "null"] },
    contact: {
      type: ["object", "null"],
      properties: {
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        links: { type: "array", items: { type: "string" } },
      },
    },
    summary: { type: ["string", "null"] },
    workHistory: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          location: { type: ["string", "null"] },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "title", "startDate", "endDate", "bullets"],
      },
    },
    skills: { type: "array", items: { type: "string" } },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          credential: { type: "string" },
          field: { type: ["string", "null"] },
          graduationDate: { type: ["string", "null"] },
        },
        required: ["institution", "credential"],
      },
    },
    awards: { type: "array", items: { type: "string" } },
    careerNarrative: { type: "string" },
  },
  required: ["workHistory", "skills", "education", "awards", "careerNarrative"],
} as const;

export const resumeAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    structured: structuredResumeSchema,
    isPolished: { type: "boolean" },
    polishIssues: { type: "array", items: { type: "string" } },
    clarifyingQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["structured", "isPolished", "polishIssues", "clarifyingQuestions"],
};

export const tailoredResumeSchema: JsonSchema = {
  type: "object",
  properties: {
    structured: structuredResumeSchema,
    renderedText: { type: "string" },
  },
  required: ["structured", "renderedText"],
};

export const toneCheckSchema: JsonSchema = {
  type: "object",
  properties: {
    humanScore: { type: "number" },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phrase: { type: "string" },
          reason: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["phrase", "reason", "suggestion"],
      },
    },
    summary: { type: "string" },
  },
  required: ["humanScore", "flags", "summary"],
};

export const jobPostingParseSchema: JsonSchema = {
  type: "object",
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    location: { type: ["string", "null"] },
    keyRequirements: { type: "array", items: { type: "string" } },
  },
  required: ["company", "role", "keyRequirements"],
};
