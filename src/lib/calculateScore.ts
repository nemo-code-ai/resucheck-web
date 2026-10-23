import type { Analysis } from "./analyzeWithAI";
import type { CodeChecksResult } from "./codeChecks";

// Points each AI category is worth. They add up to 70.
const WEIGHTS = {
  projects: 20,
  impact: 15,
  relevance: 15,
  experience: 10,
  clarity: 10,
} as const;

type CategoryName = keyof typeof WEIGHTS;

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export function calculateScore(codeChecks: CodeChecksResult, analysis: Analysis) {
  if (!analysis.is_resume || !analysis.categories) return null;

  const categories = (Object.keys(WEIGHTS) as CategoryName[]).map((name) => {
    const { score, reason } = analysis.categories![name];
    return { name, score, weight: WEIGHTS[name], points: round((score / 10) * WEIGHTS[name]), reason };
  });

  const qualityPoints = categories.reduce((sum, c) => sum + c.points, 0);
  const total = codeChecks.score + qualityPoints; // out of 100

  return {
    percentage: Math.round(total),
    atsPoints: codeChecks.score, // out of 30
    qualityPoints: round(qualityPoints), // out of 70
    categories,
  };
}
