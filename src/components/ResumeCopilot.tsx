"use client";

import { useEffect, useState } from "react";
import type {
  JobPostingInsights,
  ResumeAnalysis,
  ToneCheckResult,
} from "@/types/resume";
import { ADZUNA_COUNTRIES, type JobSearchResult } from "@/types/jobSearch";

type Step = "upload" | "review" | "result";

interface TailoredResume {
  versionId: string;
  renderedText: string;
}

interface HistoryEntry {
  versionId: string;
  resumeId: string;
  jobTargetId: string | null;
  createdAt: string;
  preview: string;
  renderedText: string;
  toneCheck: ToneCheckResult | null;
  company: string | null;
  role: string | null;
  location: string | null;
  keyRequirements: string[];
  linkedinSearchUrl: string | null;
  jobText: string;
}

async function postJson<T>(
  url: string,
  body: unknown,
  method: "POST" | "GET" = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong");
  }
  return data as T;
}

export function ResumeCopilot() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const [resumeId, setResumeId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [jobText, setJobText] = useState("");

  const [jobInsights, setJobInsights] = useState<JobPostingInsights | null>(null);
  const [jobTargetId, setJobTargetId] = useState<string | null>(null);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [toneCheck, setToneCheck] = useState<ToneCheckResult | null>(null);
  const [toneChecking, setToneChecking] = useState(false);
  const [humanizeAnswers, setHumanizeAnswers] = useState<Record<string, string>>({});
  const [humanizing, setHumanizing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await postJson<{
          resumeId: string | null;
          analysis?: ResumeAnalysis;
          jobText?: string;
          jobInsights?: (JobPostingInsights & { jobTargetId: string }) | null;
          tailored?: TailoredResume | null;
          toneCheck?: ToneCheckResult | null;
        }>("/api/resume/latest", undefined, "GET");
        if (cancelled || !latest.resumeId) return;

        setResumeId(latest.resumeId);
        if (latest.analysis) setAnalysis(latest.analysis);
        if (latest.jobText) setJobText(latest.jobText);
        if (latest.jobInsights) {
          setJobInsights(latest.jobInsights);
          setJobTargetId(latest.jobInsights.jobTargetId);
        }
        if (latest.tailored) {
          setTailored(latest.tailored);
          setToneCheck(latest.toneCheck ?? null);
          setStep("result");
        } else if (latest.analysis) {
          setStep("review");
        }
      } catch {
        // No restorable progress — start fresh at the upload step.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleStartOver() {
    setStep("upload");
    setResumeId(null);
    setAnalysis(null);
    setAnswers({});
    setJobText("");
    setJobInsights(null);
    setJobTargetId(null);
    setTailored(null);
    setToneCheck(null);
    setHumanizeAnswers({});
  }

  async function handleOpenHistory() {
    setShowHistory(true);
    if (history) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await postJson<{ versions: HistoryEntry[] }>(
        "/api/resume/versions",
        undefined,
        "GET",
      );
      setHistory(res.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleLoadVersion(entry: HistoryEntry) {
    setResumeId(entry.resumeId);
    setJobTargetId(entry.jobTargetId);
    setJobText(entry.jobText);
    setJobInsights(
      entry.company
        ? {
            company: entry.company,
            role: entry.role ?? "",
            location: entry.location ?? undefined,
            keyRequirements: entry.keyRequirements,
            linkedinSearchUrl: entry.linkedinSearchUrl ?? "",
          }
        : null,
    );
    setTailored({ versionId: entry.versionId, renderedText: entry.renderedText });
    setToneCheck(entry.toneCheck);
    setHumanizeAnswers({});
    setStep("result");
    setShowHistory(false);
  }

  async function handleUpload(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const uploadRes = await postJson<{ resumeId: string }>(
        "/api/resume/upload",
        formData,
      );
      setResumeId(uploadRes.resumeId);
      const analysisRes = await postJson<ResumeAnalysis>("/api/resume/analyze", {
        resumeId: uploadRes.resumeId,
      });
      setAnalysis(analysisRes);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitTarget() {
    if (!resumeId || !jobText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const job = await postJson<JobPostingInsights & { jobTargetId: string }>(
        "/api/job/parse",
        { postingText: jobText, resumeId },
      );
      setJobInsights(job);
      setJobTargetId(job.jobTargetId);

      const tailoredRes = await postJson<{ versionId: string; renderedText: string }>(
        "/api/resume/tailor",
        {
          resumeId,
          targetJobDescription: jobText,
          clarifyingAnswers: answers,
          jobTargetId: job.jobTargetId,
        },
      );
      setTailored(tailoredRes);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not tailor resume");
    } finally {
      setBusy(false);
    }
  }

  async function handleToneCheck() {
    if (!tailored) return;
    setToneChecking(true);
    setError(null);
    try {
      const result = await postJson<ToneCheckResult>("/api/resume/tone-check", {
        versionId: tailored.versionId,
      });
      setToneCheck(result);
      setHumanizeAnswers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run tone check");
    } finally {
      setToneChecking(false);
    }
  }

  async function handleHumanize() {
    if (!tailored || !toneCheck || !resumeId) return;
    setHumanizing(true);
    setError(null);
    try {
      const feedback = toneCheck.flags.map((f) => ({
        phrase: f.phrase,
        reason: f.reason,
        suggestion: f.suggestion,
        userAnswer: humanizeAnswers[f.phrase]?.trim() || undefined,
      }));
      const tailoredRes = await postJson<{ versionId: string; renderedText: string }>(
        "/api/resume/tailor",
        {
          resumeId,
          targetJobDescription: jobText,
          clarifyingAnswers: answers,
          jobTargetId,
          baseVersionId: tailored.versionId,
          humanizationFeedback: feedback,
        },
      );
      setTailored(tailoredRes);
      setToneCheck(null);
      setHumanizeAnswers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update resume");
    } finally {
      setHumanizing(false);
    }
  }

  if (restoring) {
    return <p className="text-sm text-neutral-500">Loading your progress…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <StepIndicator step={step} />
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={handleOpenHistory}
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            History
          </button>
          {step !== "upload" && (
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm text-neutral-500 underline underline-offset-2"
            >
              Start over with a different resume
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <HistoryPanel
          entries={history}
          loading={historyLoading}
          onClose={() => setShowHistory(false)}
          onLoad={handleLoadVersion}
        />
      )}

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {step === "upload" && <UploadPanel busy={busy} onSubmit={handleUpload} />}

      {step === "review" && analysis && (
        <ReviewPanel
          analysis={analysis}
          answers={answers}
          onAnswerChange={(q, a) => setAnswers((prev) => ({ ...prev, [q]: a }))}
          jobText={jobText}
          onJobTextChange={setJobText}
          busy={busy}
          onSubmit={handleSubmitTarget}
        />
      )}

      {step === "result" && tailored && (
        <ResultPanel
          versionId={tailored.versionId}
          renderedText={tailored.renderedText}
          jobInsights={jobInsights}
          toneCheck={toneCheck}
          toneChecking={toneChecking}
          onToneCheck={handleToneCheck}
          humanizeAnswers={humanizeAnswers}
          onHumanizeAnswerChange={(phrase, value) =>
            setHumanizeAnswers((prev) => ({ ...prev, [phrase]: value }))
          }
          humanizing={humanizing}
          onHumanize={handleHumanize}
          copied={copied}
          onCopy={async () => {
            await navigator.clipboard.writeText(tailored.renderedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        />
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Resume" },
    { key: "review", label: "2. Target job" },
    { key: "result", label: "3. Tailored resume" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex gap-4 text-sm">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={
            i <= activeIndex
              ? "font-medium text-neutral-900 dark:text-neutral-100"
              : "text-neutral-400"
          }
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function UploadPanel({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    if (file) {
      formData.set("file", file);
    } else if (pastedText.trim()) {
      formData.set("text", pastedText);
    } else {
      return;
    }
    onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Upload your resume</h2>
        <p className="text-sm text-neutral-500">
          PDF, DOCX, or TXT. Or paste your resume text below instead.
        </p>
      </div>

      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800 dark:file:bg-white dark:file:text-neutral-900 dark:hover:file:bg-neutral-200"
      />

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or paste text
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <textarea
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        placeholder="Paste your resume text here…"
        rows={8}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <button
        type="submit"
        disabled={busy || (!file && !pastedText.trim())}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {busy ? "Analyzing…" : "Analyze resume"}
      </button>
    </form>
  );
}

function ReviewPanel({
  analysis,
  answers,
  onAnswerChange,
  jobText,
  onJobTextChange,
  busy,
  onSubmit,
}: {
  analysis: ResumeAnalysis;
  answers: Record<string, string>;
  onAnswerChange: (question: string, answer: string) => void;
  jobText: string;
  onJobTextChange: (text: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-base font-semibold">What we picked up on</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {analysis.structured.careerNarrative}
        </p>
      </div>

      {!analysis.isPolished && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Your resume could use more detail
          </h3>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-800 dark:text-amber-300">
            {analysis.polishIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>

          {analysis.clarifyingQuestions.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Answer these questions to sharpen your resume more — your answers get used
                when we tailor it, so specifics here become specifics in your bullets.
              </p>
              {analysis.clarifyingQuestions.map((q) => (
                <label key={q} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-amber-900 dark:text-amber-200">{q}</span>
                  <input
                    type="text"
                    value={answers[q] ?? ""}
                    onChange={(e) => onAnswerChange(q, e.target.value)}
                    className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-amber-800 dark:bg-neutral-900"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <TargetJobPicker jobText={jobText} onJobTextChange={onJobTextChange} />

      <button
        type="button"
        disabled={busy || !jobText.trim()}
        onClick={onSubmit}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {busy ? "Tailoring your resume…" : "Tailor my resume"}
      </button>
    </div>
  );
}

type TargetMode = "search" | "paste";

function TargetJobPicker({
  jobText,
  onJobTextChange,
}: {
  jobText: string;
  onJobTextChange: (text: string) => void;
}) {
  const [mode, setMode] = useState<TargetMode>("search");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">What job are you targeting?</h2>
        <p className="text-sm text-neutral-500">
          Search real openings, or paste a posting yourself — either way we&apos;ll tailor
          your resume to it and find a networking contact.
        </p>
      </div>

      <div className="flex gap-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "search"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
          }`}
        >
          Search for openings
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded-md px-3 py-1.5 font-medium ${
            mode === "paste"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
          }`}
        >
          Paste a posting
        </button>
      </div>

      {mode === "search" ? (
        <JobSearchTab
          onUseJob={(job) => {
            onJobTextChange(
              `${job.title} at ${job.company} (${job.location})\n\n${job.description}`,
            );
            setMode("paste");
          }}
        />
      ) : (
        <textarea
          value={jobText}
          onChange={(e) => onJobTextChange(e.target.value)}
          rows={8}
          placeholder="Paste the job posting here…"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}
    </div>
  );
}

function JobSearchTab({ onUseJob }: { onUseJob: (job: JobSearchResult) => void }) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("us");
  const [results, setResults] = useState<JobSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await postJson<{ results: JobSearchResult[] }>("/api/job/search", {
        keywords,
        location: location.trim() || undefined,
        country,
      });
      setResults(res.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Job title or keywords (e.g. backend engineer)"
          className="min-w-[220px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City or region (optional)"
          className="min-w-[160px] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {ADZUNA_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={searching || !keywords.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {searchError && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {searchError}
        </p>
      )}

      {results && results.length === 0 && !searchError && (
        <p className="text-sm text-neutral-500">No openings found — try different keywords.</p>
      )}

      {results && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((job) => (
            <li
              key={job.id}
              className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{job.title}</p>
                  <p className="text-sm text-neutral-500">
                    {job.company} — {job.location}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUseJob(job)}
                  className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  Use this job
                </button>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-neutral-500">{job.description}</p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-neutral-400 underline underline-offset-2"
              >
                View original posting ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultPanel({
  versionId,
  renderedText,
  jobInsights,
  toneCheck,
  toneChecking,
  onToneCheck,
  humanizeAnswers,
  onHumanizeAnswerChange,
  humanizing,
  onHumanize,
  copied,
  onCopy,
}: {
  versionId: string;
  renderedText: string;
  jobInsights: JobPostingInsights | null;
  toneCheck: ToneCheckResult | null;
  toneChecking: boolean;
  onToneCheck: () => void;
  humanizeAnswers: Record<string, string>;
  onHumanizeAnswerChange: (phrase: string, value: string) => void;
  humanizing: boolean;
  onHumanize: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {jobInsights && (
        <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-base font-semibold">
            {jobInsights.role} @ {jobInsights.company}
          </h2>
          {jobInsights.location && (
            <p className="text-sm text-neutral-500">{jobInsights.location}</p>
          )}
          <ul className="mt-2 list-inside list-disc text-sm text-neutral-600 dark:text-neutral-400">
            {jobInsights.keyRequirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
          <a
            href={jobInsights.linkedinSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Find a recruiter to network with on LinkedIn ↗
          </a>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your tailored resume</h2>
          <button
            type="button"
            onClick={onCopy}
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            {copied ? "Copied!" : "Copy text"}
          </button>
        </div>
        <textarea
          readOnly
          value={renderedText}
          rows={20}
          className="whitespace-pre-wrap rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!toneCheck && (
          <button
            type="button"
            onClick={onToneCheck}
            disabled={toneChecking}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {toneChecking ? "Checking tone…" : "Does this sound human?"}
          </button>
        )}
        <SaveMenu versionId={versionId} />
      </div>

      {toneCheck && (
        <div className="rounded-md border border-sky-300 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950">
          <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            Human-sounding score: {toneCheck.humanScore}/100
          </h3>
          <p className="mt-1 text-sm text-sky-900 dark:text-sky-200">{toneCheck.summary}</p>
          {toneCheck.flags.length > 0 && (
            <>
              <ul className="mt-3 flex flex-col gap-3">
                {toneCheck.flags.map((flag) => (
                  <li key={flag.phrase} className="text-sm text-sky-900 dark:text-sky-200">
                    <p>
                      <span className="font-medium">&ldquo;{flag.phrase}&rdquo;</span> —{" "}
                      {flag.reason}
                    </p>
                    <p className="text-sky-700 dark:text-sky-400">Try: {flag.suggestion}</p>
                    <input
                      type="text"
                      value={humanizeAnswers[flag.phrase] ?? ""}
                      onChange={(e) => onHumanizeAnswerChange(flag.phrase, e.target.value)}
                      placeholder="Got a real detail to use here? (optional)"
                      className="mt-1 w-full rounded-md border border-sky-300 px-3 py-2 text-sm dark:border-sky-800 dark:bg-neutral-900"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-sky-700 dark:text-sky-400">
                Answer any of these and we&apos;ll work your specifics in — leave blank ones for
                us to fix with the suggestion above instead.
              </p>
              <button
                type="button"
                onClick={onHumanize}
                disabled={humanizing}
                className="mt-2 self-start rounded-md bg-sky-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-100 dark:text-sky-950"
              >
                {humanizing ? "Updating your resume…" : "Update my resume with these answers"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const EXPORT_FORMATS: { format: string; label: string }[] = [
  { format: "txt", label: "Save as .txt" },
  { format: "docx", label: "Save as .docx" },
  { format: "pdf", label: "Save as .pdf" },
];

function SaveMenu({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
      >
        Save my tailored resume
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-neutral-300 bg-white p-2 shadow-md dark:border-neutral-700 dark:bg-neutral-900">
          {EXPORT_FORMATS.map(({ format, label }) => (
            <a
              key={format}
              href={`/api/resume/export?versionId=${versionId}&format=${format}`}
              download
              onClick={() => setOpen(false)}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  entries,
  loading,
  onClose,
  onLoad,
}: {
  entries: HistoryEntry[] | null;
  loading: boolean;
  onClose: () => void;
  onLoad: (entry: HistoryEntry) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your tailored resumes</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 underline underline-offset-2"
          >
            Close
          </button>
        </div>

        {loading && <p className="text-sm text-neutral-500">Loading…</p>}

        {!loading && entries && entries.length === 0 && (
          <p className="text-sm text-neutral-500">
            No tailored resumes yet — finish tailoring one and it&apos;ll show up here.
          </p>
        )}

        {!loading && entries && entries.length > 0 && (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li
                key={entry.versionId}
                className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {entry.role && entry.company
                        ? `${entry.role} @ ${entry.company}`
                        : "General resume"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.toneCheck && ` — human score ${entry.toneCheck.humanScore}/100`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoad(entry)}
                    className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    Load this version
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{entry.preview}…</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
