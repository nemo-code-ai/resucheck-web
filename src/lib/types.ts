// The shape of what the /api/analyze route sends back to the page.
export type Suggestion = {
  category: string;
  priority: "high" | "medium" | "low";
  evidence: string;
  fix: string;
};

export type CategoryResult = {
  name: string;
  score: number; // 0 to 10
  weight: number;
  points: number;
  reason: string;
};

export type AnalyzeResponse = {
  percentage: number;
  atsPoints: number; // out of 30
  qualityPoints: number; // out of 70
  categories: CategoryResult[];
  atsFindings: string[];
  suggestions: Suggestion[];
};
