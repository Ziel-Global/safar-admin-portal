import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier =
  | "free"
  | "standard"
  | "professional"
  | "premium"
  | "enterprise";

export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  standard: 1,
  professional: 2,
  premium: 3,
  enterprise: 4,
};

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  standard: "Standard",
  professional: "Professional",
  premium: "Premium",
  enterprise: "Enterprise",
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price_monthly: number;
  currency: string;
  features: string[];
  lead_limit: number | null;
  sort_order: number;
  is_custom: boolean;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    tier: row.tier as SubscriptionTier,
    price_monthly: Number(row.price_monthly ?? 0),
    currency: (row as { currency?: string }).currency ?? "GBP",
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    lead_limit: (row as { lead_limit?: number | null }).lead_limit ?? null,
    sort_order: row.sort_order,
    is_custom: (row as { is_custom?: boolean }).is_custom ?? false,
  }));
}

export function tierMeets(
  current: SubscriptionTier | string | null | undefined,
  required: SubscriptionTier,
): boolean {
  const c = (current ?? "free") as SubscriptionTier;
  return (TIER_RANK[c] ?? 0) >= (TIER_RANK[required] ?? 0);
}

export async function setAgentTier(
  agentId: string,
  tier: SubscriptionTier,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("agents")
    .update({ subscription_tier: tier })
    .eq("id", agentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
