import type { FullResult, Suggestion, TeaserResult } from "./types";

// ---- The rules. Change these numbers to change the product. ----
export const MAX_ANALYSES_PER_USER = 3; // for signed-in users (includes the free one)
export const MAX_ANON_ANALYSES = 1; // free checks before signing in
export const FREE_CATEGORIES = ["projects", "impact", "clarity"]; // shown without signing in
export const FREE_SUGGESTION_COUNT = 1; // real suggestions shown as a taste

export type AccessDecision = "allow" | "SIGN_IN_REQUIRED" | "LIMIT_REACHED";

export function decideAccess(input: {
  signedIn: boolean;
  userCount: number; // analyses already saved for this user
  anonCount: number; // analyses already saved for this browser
}): AccessDecision {
  if (input.signedIn) {
    return input.userCount >= MAX_ANALYSES_PER_USER ? "LIMIT_REACHED" : "allow";
  }
  return input.anonCount >= MAX_ANON_ANALYSES ? "SIGN_IN_REQUIRED" : "allow";
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

// Builds the anonymous version of a result. Anything locked is removed here,
// on the server, so it never reaches the browser at all.
export function toTeaser(full: FullResult): TeaserResult {
  const visible = full.categories.filter((c) => FREE_CATEGORIES.includes(c.name));
  const lockedCategories = full.categories
    .filter((c) => !FREE_CATEGORIES.includes(c.name))
    .map((c) => c.name);

  const bestFirst: Suggestion[] = [...full.suggestions].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
  const freeSuggestions = bestFirst.slice(0, FREE_SUGGESTION_COUNT);

  return {
    access: "teaser",
    percentage: full.percentage,
    atsPoints: full.atsPoints,
    qualityPoints: full.qualityPoints,
    categories: visible,
    lockedCategories,
    freeSuggestions,
    locked: {
      suggestions: Math.max(0, full.suggestions.length - freeSuggestions.length),
      atsFindings: full.atsFindings.length,
    },
  };
}
