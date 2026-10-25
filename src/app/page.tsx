"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { createClient } from "@/src/lib/supabase/client";
import type {
  AnalyzeResult,
  ApiError,
  CategoryResult,
  SessionInfo,
  Suggestion,
} from "@/src/lib/types";

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

// ---------- small building blocks ----------

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6 shrink-0 text-brand-600"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove file"
      title="Remove file"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-brand-50 hover:text-brand-700"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 p-5 shadow-sm sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function CategoryRow({ category }: { category: CategoryResult }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{CATEGORY_LABELS[category.name] ?? category.name}</span>
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
  );
}

function LockedCategoryRow({ name, onSignIn }: { name: string; onSignIn: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignIn}
      className="flex w-full items-center justify-between rounded-lg bg-neutral-50 px-3 py-3 text-left text-sm transition hover:bg-brand-50"
    >
      <span className="font-medium">{CATEGORY_LABELS[name] ?? name}</span>
      <span className="flex items-center gap-1.5 text-neutral-500">
        <LockIcon /> Sign in to unlock
      </span>
    </button>
  );
}

function SuggestionItem({ suggestion }: { suggestion: Suggestion }) {
  return (
    <li className="text-sm">
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
  );
}

function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
    >
      {label}
    </button>
  );
}

function SignInCard({ title, body, onSignIn }: { title: string; body: string; onSignIn: () => void }) {
  return (
    <Card className="border-brand-200 bg-brand-50/40 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">{body}</p>
      <div className="mx-auto mt-4 max-w-xs">
        <GoogleButton onClick={onSignIn} label="Continue with Google" />
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        We use your email only to save your results. Your PDF is never stored.
      </p>
    </Card>
  );
}

function LimitCard({
  limit,
  joined,
  busy,
  onJoin,
}: {
  limit: number;
  joined: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <Card className="text-center">
      <h2 className="text-lg font-semibold">You&apos;ve used all {limit} free checks</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
        A paid plan with more checks is on the way. Join the waitlist and we&apos;ll let you know when
        it&apos;s ready.
      </p>
      <div className="mx-auto mt-4 max-w-xs">
        {joined ? (
          <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
            You&apos;re on the list. Thank you!
          </p>
        ) : (
          <button
            type="button"
            onClick={onJoin}
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {busy ? "Joining..." : "Notify me about the paid plan"}
          </button>
        )}
      </div>
    </Card>
  );
}

// ---------- the results ----------

function Results({
  result,
  file,
  previewUrl,
  onRemoveFile,
  onSignIn,
}: {
  result: AnalyzeResult;
  file: File | null;
  previewUrl: string | null;
  onRemoveFile: () => void;
  onSignIn: () => void;
}) {
  const isTeaser = result.access === "teaser";

  return (
    <section className="mt-8 space-y-6">
      <div className={`grid gap-6 ${file ? "md:grid-cols-[1fr_15rem]" : ""}`}>
        <div className="flex flex-col justify-center rounded-2xl border border-neutral-200 p-6 text-center shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Your ResuCheck score
          </p>
          <p className="mt-1 text-6xl font-bold text-brand-600">{result.percentage}%</p>
          <p className="mt-2 text-sm text-neutral-600">
            ATS-friendliness {result.atsPoints}/30 &nbsp;|&nbsp; Quality {result.qualityPoints}/70
          </p>
        </div>

        {file && (
          <div className="order-first rounded-2xl border border-neutral-200 p-4 shadow-sm md:order-last">
            <div className="flex items-center gap-3">
              <DocumentIcon />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
              </div>
              <RemoveButton onClick={onRemoveFile} />
            </div>
            {previewUrl && (
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0`}
                title="Resume preview"
                className="mt-3 hidden h-56 w-full rounded-lg border border-neutral-200 md:block"
              />
            )}
            <p className="mt-2 text-xs text-neutral-500">Shown only on your device.</p>
          </div>
        )}
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Quality breakdown</h2>
        <div className="space-y-4">
          {result.categories.map((category) => (
            <CategoryRow key={category.name} category={category} />
          ))}
          {result.access === "teaser" &&
            result.lockedCategories.map((name) => (
              <LockedCategoryRow key={name} name={name} onSignIn={onSignIn} />
            ))}
        </div>
      </Card>

      {result.access === "full" && result.atsFindings.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">ATS issues to fix</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {result.atsFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </Card>
      )}

      {result.access === "teaser" && result.locked.atsFindings > 0 && (
        <Card>
          <button
            type="button"
            onClick={onSignIn}
            className="flex w-full items-center justify-between text-left text-sm"
          >
            <span className="font-medium">
              {result.locked.atsFindings} ATS {result.locked.atsFindings === 1 ? "issue" : "issues"} found
            </span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              <LockIcon /> Sign in to see them
            </span>
          </button>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Suggestions</h2>
        <ol className="space-y-5">
          {(result.access === "full" ? result.suggestions : result.freeSuggestions).map(
            (suggestion, index) => (
              <SuggestionItem key={index} suggestion={suggestion} />
            )
          )}
        </ol>
        {result.access === "teaser" && result.locked.suggestions > 0 && (
          <button
            type="button"
            onClick={onSignIn}
            className="mt-5 flex w-full items-center justify-between rounded-lg bg-neutral-50 px-3 py-3 text-left text-sm transition hover:bg-brand-50"
          >
            <span className="font-medium">
              {result.locked.suggestions} more {result.locked.suggestions === 1 ? "suggestion" : "suggestions"}
            </span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              <LockIcon /> Sign in to unlock
            </span>
          </button>
        )}
      </Card>

      {isTeaser && (
        <SignInCard
          title="Unlock your full report"
          body="Sign in with Google to see every score, all your ATS issues, and every suggestion. You get 3 checks in total, including the one you just used."
          onSignIn={onSignIn}
        />
      )}
    </section>
  );
}

// ---------- the page ----------

export default function Home() {
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [joining, setJoining] = useState(false);

  // Who is signed in? And, right after sign-in, show the unlocked report.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlocked = params.get("unlocked") === "1";
    const authFailed = params.get("auth_error") === "1";
    if (unlocked || authFailed) window.history.replaceState({}, "", "/");

    async function loadSession() {
      try {
        const response = await fetch(`/api/session${unlocked ? "?latest=1" : ""}`);
        if (!response.ok) return;
        const info = (await response.json()) as SessionInfo;
        setSession(info);
        if (info.latest) setResult(info.latest);
        if (authFailed) setError("Sign-in didn't complete. Please try again.");
      } catch {
        // The page still works without it; the server checks everything again.
      }
    }
    loadSession();
  }, []);

  const signedIn = Boolean(session?.signedIn);
  const anonBlocked = Boolean(session && !session.signedIn && session.anonUsed);
  const limitBlocked = Boolean(session && session.signedIn && session.used >= session.limit);
  const showForm = !anonBlocked && !limitBlocked;
  // If a teaser is on screen it already has its own sign-in card.
  const showGate = !showForm && result?.access !== "teaser";

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) setError("We couldn't start Google sign-in. Please try again.");
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.reload();
  }

  async function joinWaitlist() {
    setJoining(true);
    try {
      const response = await fetch("/api/waitlist", { method: "POST" });
      if (!response.ok) throw new Error();
      setSession((current) => (current ? { ...current, onWaitlist: true } : current));
    } catch {
      setError("We couldn't add you to the waitlist. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  // Choosing or removing a file. The preview URL lives only in this browser
  // tab and is released when the file is removed or replaced.
  function selectFile(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    setError(null);
  }

  function removeFile() {
    selectFile(null);
  }

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
        const apiError = data as ApiError | null;
        if (apiError?.code === "SIGN_IN_REQUIRED") {
          setSession((s) => (s ? { ...s, anonUsed: true } : s));
        }
        if (apiError?.code === "LIMIT_REACHED") {
          setSession((s) => (s ? { ...s, used: s.limit } : s));
        }
        throw new Error(apiError?.error ?? "The server failed or took too long. Please try again.");
      }

      const next = data as AnalyzeResult;
      setResult(next);
      if (next.access === "full") {
        setSession((s) => (s ? { ...s, used: next.used } : s));
      } else {
        // Their free check is now used.
        setSession((s) => (s ? { ...s, anonUsed: true } : s));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      {/* Top bar */}
      <div className="mb-2 flex min-h-8 items-center justify-end gap-3 text-sm">
        {session &&
          (signedIn ? (
            <>
              <span className="truncate text-neutral-600">
                {session.email ?? "Signed in"} &middot; {session.used}/{session.limit} checks used
              </span>
              <button
                type="button"
                onClick={signOut}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1 font-medium transition hover:bg-neutral-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="rounded-lg border border-neutral-300 px-3 py-1 font-medium transition hover:bg-neutral-50"
            >
              Sign in
            </button>
          ))}
      </div>

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

      {/* Upload form, or the reason it is closed */}
      {showForm && (
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
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-300 px-3 py-2">
                <DocumentIcon />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
                </div>
                <RemoveButton onClick={removeFile} />
              </div>
            ) : (
              <input
                id="file"
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
            )}
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
      )}

      {showGate && anonBlocked && (
        <SignInCard
          title="You've used your free check"
          body="Sign in with Google to see your full report and run more checks. You get 3 checks in total."
          onSignIn={signInWithGoogle}
        />
      )}

      {showGate && limitBlocked && session && (
        <LimitCard
          limit={session.limit}
          joined={session.onWaitlist}
          busy={joining}
          onJoin={joinWaitlist}
        />
      )}

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
        <Results
          result={result}
          file={file}
          previewUrl={previewUrl}
          onRemoveFile={removeFile}
          onSignIn={signInWithGoogle}
        />
      )}
    </main>
  );
}
