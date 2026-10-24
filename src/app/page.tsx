"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import type { AnalyzeResponse } from "@/src/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  projects: "Projects and technical depth",
  impact: "Impact and measurable results",
  relevance: "Relevance to the role",
  experience: "Experience",
  clarity: "Clarity and writing",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-brand-600 text-white",
  medium: "bg-brand-100 text-brand-700",
  low: "bg-neutral-100 text-neutral-600",
};

export default function Home() {
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Please choose a PDF resume.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("role", role);
      body.append("file", file);

      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "The server failed or took too long. Please try again.");
      }
      setResult(data as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="ResuCheck logo"
          width={600}
          height={657}
          priority
          className="h-24 w-auto sm:h-28"
        />
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Resu<span className="text-brand-600">Check</span>
        </h1>
        <p className="mt-2 text-neutral-600">
          Upload your resume and see how it scores for the role you want.
        </p>
      </header>

      {/* Upload form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-neutral-200 p-5 shadow-sm sm:p-6"
      >
        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium">
            Target job title
          </label>
          <input
            id="role"
            type="text"
            required
            maxLength={100}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Frontend Developer"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label htmlFor="file" className="mb-1 block text-sm font-medium">
            Resume (PDF, up to 4 MB)
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {loading ? "Analyzing... this can take up to 30 seconds" : "Check my resume"}
        </button>

        <p className="text-center text-xs text-neutral-500">
          Your PDF is never stored. It is deleted right after the check.
        </p>
      </form>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border border-neutral-200 p-6 text-center shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Your ResuCheck score
            </p>
            <p className="mt-1 text-6xl font-bold text-brand-600">{result.percentage}%</p>
            <p className="mt-2 text-sm text-neutral-600">
              ATS-friendliness {result.atsPoints}/30 &nbsp;|&nbsp; Quality {result.qualityPoints}/70
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Quality breakdown</h2>
            <div className="space-y-4">
              {result.categories.map((category) => (
                <div key={category.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">
                      {CATEGORY_LABELS[category.name] ?? category.name}
                    </span>
                    <span className="text-neutral-600">{category.score}/10</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-brand-600"
                      style={{ width: `${category.score * 10}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{category.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {result.atsFindings.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 text-lg font-semibold">ATS issues to fix</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {result.atsFindings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Suggestions</h2>
            <ol className="space-y-5">
              {result.suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[suggestion.priority]}`}
                  >
                    {suggestion.priority}
                  </span>
                  <span className="text-neutral-500">
                    {CATEGORY_LABELS[suggestion.category] ?? suggestion.category}
                  </span>
                  <p className="mt-2 text-neutral-500">
                    <span className="font-medium text-neutral-700">Where: </span>
                    {suggestion.evidence}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Fix: </span>
                    {suggestion.fix}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </main>
  );
}
