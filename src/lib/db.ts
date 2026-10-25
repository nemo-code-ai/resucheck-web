import { createAdminClient } from "./supabase/admin";
import type { CategoryResult, FullResult, Suggestion } from "./types";
import { MAX_ANALYSES_PER_USER } from "./access";

type Owner = { userId: string } | { anonId: string };

export async function countUserAnalyses(userId: string) {
  const { count, error } = await createAdminClient()
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function countAnonAnalyses(anonId: string) {
  const { count, error } = await createAdminClient()
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("anon_id", anonId);
  if (error) throw error;
  return count ?? 0;
}

export async function saveAnalysis(
  owner: Owner,
  targetRole: string,
  full: Omit<FullResult, "access" | "used" | "limit">
) {
  const { error } = await createAdminClient()
    .from("analyses")
    .insert({
      user_id: "userId" in owner ? owner.userId : null,
      anon_id: "anonId" in owner ? owner.anonId : null,
      target_role: targetRole,
      percentage: full.percentage,
      ats_points: full.atsPoints,
      quality_points: full.qualityPoints,
      categories: full.categories,
      ats_findings: full.atsFindings,
      suggestions: full.suggestions,
    });
  if (error) throw error;
}

// After sign-in: attach this browser's anonymous result to the new account.
// Returns how many results were claimed.
export async function claimAnonymous(anonId: string, userId: string) {
  const { data, error } = await createAdminClient()
    .from("analyses")
    .update({ user_id: userId })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function latestForUser(userId: string): Promise<FullResult | null> {
  const { data, error } = await createAdminClient()
    .from("analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const used = await countUserAnalyses(userId);
  return {
    access: "full",
    percentage: row.percentage,
    atsPoints: Number(row.ats_points),
    qualityPoints: Number(row.quality_points),
    categories: row.categories as CategoryResult[],
    atsFindings: row.ats_findings as string[],
    suggestions: row.suggestions as Suggestion[],
    used,
    limit: MAX_ANALYSES_PER_USER,
  };
}

export async function isOnWaitlist(userId: string) {
  const { count, error } = await createAdminClient()
    .from("waitlist")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function joinWaitlist(userId: string) {
  const { error } = await createAdminClient()
    .from("waitlist")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
}
