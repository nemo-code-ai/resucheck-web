import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/extractText";
import { runCodeChecks } from "@/lib/codeChecks";
import { analyzeWithAI } from "@/lib/analyzeWithAI";
import { calculateScore } from "@/lib/calculateScore";
import type { AnalyzeResponse } from "@/lib/types";

export const maxDuration = 60; // seconds; the AI call can take a while

// Vercel rejects request bodies above about 4.5 MB, so stay under that.
const MAX_BYTES = 4 * 1024 * 1024;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

  // ---------- 2. Read the PDF (in memory only) ----------
  let extracted;
  try {
    extracted = await extractResumeText(bytes);
  } catch {
    return fail("We couldn't open this PDF. It may be damaged or password-protected.", 400);
  }
  if (!extracted.readable) {
    return fail(
      "We couldn't read any text in this PDF. It may be a scan or an image, which ATS software can't read either. This did not count as an upload.",
      422
    );
  }

  // ---------- 3. Score it ----------
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

  const result = calculateScore(checks, analysis);
  if (!result) {
    return fail("This doesn't look like a resume, so it did not count as an upload.", 422);
  }

  // Later: this is where we will count the upload for the signed-in user.

  const response: AnalyzeResponse = {
    ...result,
    atsFindings: checks.findings,
    suggestions: analysis.suggestions ?? [],
  };
  return NextResponse.json(response);
}
