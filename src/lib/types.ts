// Shapes shared by the API routes and the page.

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

// What a signed-in user gets: everything.
export type FullResult = {
  access: "full";
  percentage: number;
  atsPoints: number; // out of 30
  qualityPoints: number; // out of 70
  categories: CategoryResult[];
  atsFindings: string[];
  suggestions: Suggestion[];
  used: number; // analyses used so far, including this one
  limit: number;
};

// What an anonymous visitor gets: the score, part of the breakdown, a taste.
export type TeaserResult = {
  access: "teaser";
  percentage: number;
  atsPoints: number;
  qualityPoints: number;
  categories: CategoryResult[]; // only the free ones
  lockedCategories: string[]; // names only, no scores or reasons
  freeSuggestions: Suggestion[];
  locked: { suggestions: number; atsFindings: number }; // just counts
};

export type AnalyzeResult = FullResult | TeaserResult;

export type ApiError = {
  error: string;
  code?: "SIGN_IN_REQUIRED" | "LIMIT_REACHED";
};

export type SessionInfo = {
  signedIn: boolean;
  email: string | null;
  used: number;
  limit: number;
  onWaitlist: boolean;
  anonUsed: boolean; // a signed-out visitor who already used their free check
  latest: FullResult | null;
};
