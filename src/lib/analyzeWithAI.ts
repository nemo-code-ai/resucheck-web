import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

const categoryScore = z.object({
  score: z.number().min(0).max(10),
  reason: z.string(),
});

// The "contract": the AI's answer must match this shape, or we reject it.
export const analysisSchema = z.object({
  is_resume: z.boolean(),
  categories: z
    .object({
      projects: categoryScore,
      impact: categoryScore,
      relevance: categoryScore,
      experience: categoryScore,
      clarity: categoryScore,
    })
    .optional(),
  suggestions: z
    .array(
      z.object({
        category: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        evidence: z.string(),
        fix: z.string(),
      })
    )
    .optional(),
});

export type Analysis = z.infer<typeof analysisSchema>;

// Model names change often. Keep the name in .env so you can swap it
// without touching the code.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export function parseAnalysis(raw: string): Analysis {
  // some models wrap JSON in ```json fences even when told not to
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = analysisSchema.parse(JSON.parse(cleaned));
  if (parsed.is_resume && !parsed.categories) {
    throw new Error("The AI said this is a resume but returned no category scores.");
  }
  return parsed;
}

export async function analyzeWithAI(resumeText: string, targetRole: string): Promise<Analysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing from your .env file.");

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildUserMessage(resumeText, targetRole),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });
      return parseAnalysis(response.text ?? "");
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // Retrying will not fix these, so stop right away.
      if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
        throw new Error("Rate limit reached on the free tier. Wait a bit, or try a different model in .env.", { cause: error });
      }
      if (/404|not found/i.test(message)) {
        throw new Error(`Model "${MODEL}" was not found. Check the current model names in Google AI Studio and update GEMINI_MODEL in .env.`, { cause: error });
      }
      console.warn(`Attempt ${attempt} failed: ${message}`);
    }
  }
  throw new Error("The AI analysis failed twice in a row.", { cause: lastError });
}
