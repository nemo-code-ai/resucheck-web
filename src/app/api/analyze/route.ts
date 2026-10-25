import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractResumeText } from "@/src/lib/extractText";
import { runCodeChecks } from "@/src/lib/codeChecks";
import { analyzeWithAI } from "@/src/lib/analyzeWithAI";
import { calculateScore } from "@/src/lib/calculateScore";
import { getCurrentUser } from "@/src/lib/supabase/server";
import { countAnonAnalyses, countUserAnalyses, saveAnalysis } from "@/src/lib/db";
import { MAX_ANALYSES_PER_USER, decideAccess, toTeaser } from "@/src/lib/access";
import type { ApiError, FullResult } from "@/src/lib/types";

export const maxDuration = 60; // seconds; the AI call can take a while

// Vercel rejects request bodies above about 4.5 MB, so stay under that.
const MAX_BYTES = 4 * 1024 * 1024;

// A random id kept in the visitor's browser, so we can recognise
// "this browser already used its free check".
const ANON_COOKIE = "rc_anon";
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function fail(message: string, status: number, code?: ApiError["code"]) {
  const body: ApiError = code ? { error: message, code } : { error: message };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  // ---------- 1. Validate the input ----------
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid request.", 400);
  }

  const role = String(form.get("role") ?? "").trim();
  const file = form.get("file");

  if (!role || role.length > 100) {
    return fail("Please enter a target job title (up to 100 characters).", 400);
  }
  if (!(file instanceof File)) {
    return fail("Please upload a PDF resume.", 400);
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return fail("The file must be a PDF under 4 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Real PDFs start with "%PDF". Checking the content, not just the name.
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
    return fail("That doesn't look like a PDF file.", 400);
  }

  // ---------- 2. Who is this, and are they allowed another check? ----------
  const cookieJar = await cookies();
  const existingAnonId = cookieJar.get(ANON_COOKIE)?.value;
  const anonId = existingAnonId ?? crypto.randomUUID();

  let user: { id: string; email: string | null } | null = null;
  let usedBefore = 0;
  try {
    user = await getCurrentUser();
    const [userCount, anonCount] = await Promise.all([
      user ? countUserAnalyses(user.id) : Promise.resolve(0),
      existingAnonId ? countAnonAnalyses(existingAnonId) : Promise.resolve(0),
    ]);
    usedBefore = userCount;

    const decision = decideAccess({ signedIn: Boolean(user), userCount, anonCount });
    if (decision === "SIGN_IN_REQUIRED") {
      return fail(
        "You've used your free check. Sign in with Google to unlock your report and get more checks.",
        403,
        "SIGN_IN_REQUIRED"
      );
    }
    if (decision === "LIMIT_REACHED") {
      return fail("You've used all your free checks.", 403, "LIMIT_REACHED");
    }
  } catch (error) {
    console.error("Access check failed:", error);
    return fail("Something went wrong on our side. Please try again.", 500);
  }

  // ---------- 3. Read the PDF (in memory only) ----------
  let extracted;
  try {
    extracted = await extractResumeText(bytes);
  } catch {
    return fail("We couldn't open this PDF. It may be damaged or password-protected.", 400);
  }
  if (!extracted.readable) {
    return fail(
      "We couldn't read any text in this PDF. It may be a scan or an image, which ATS software can't read either. This did not count as a check.",
      422
    );
  }

  // ---------- 4. Score it ----------
  const checks = runCodeChecks(extracted.text, extracted.pages, extracted.links);

  let analysis;
  try {
    analysis = await analyzeWithAI(extracted.text, role);
  } catch (error) {
    console.error("AI analysis failed:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return fail(
      process.env.NODE_ENV === "production"
        ? "The AI review failed. Please try again in a moment."
        : `The AI review failed: ${detail}`,
      502
    );
  }

  const scored = calculateScore(checks, analysis);
  if (!scored) {
    return fail("This doesn't look like a resume, so it did not count as a check.", 422);
  }

  const core = {
    percentage: scored.percentage,
    atsPoints: scored.atsPoints,
    qualityPoints: scored.qualityPoints,
    categories: scored.categories,
    atsFindings: checks.findings,
    suggestions: analysis.suggestions ?? [],
  };

  // ---------- 5. Save the result (never the PDF) ----------
  try {
    await saveAnalysis(user ? { userId: user.id } : { anonId }, role, core);
  } catch (error) {
    console.error("Saving the result failed:", error);
    return fail("We couldn't save your result. Please try again.", 500);
  }

  // ---------- 6. Answer ----------
  const full: FullResult = {
    access: "full",
    ...core,
    used: usedBefore + 1,
    limit: MAX_ANALYSES_PER_USER,
  };

  if (user) return NextResponse.json(full);

  // Anonymous visitor: remember this browser, and send only the teaser.
  cookieJar.set(ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE,
  });
  return NextResponse.json(toTeaser(full));
}
