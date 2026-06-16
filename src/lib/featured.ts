import { supabase } from "@/integrations/supabase/client";

export interface FeaturedCampaign {
  id: string;
  agent_id: string;
  package_id: string;
  name: string | null;
  target_markets: string[];
  budget: number;
  bid_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export async function fetchAgentFeaturedCampaigns(agentId: string): Promise<FeaturedCampaign[]> {
  const { data, error } = await supabase
    .from("featured_campaigns")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as FeaturedCampaign[];
}

export async function fetchFeaturedMetrics(
  campaignIds: string[],
): Promise<Map<string, { impressions: number; clicks: number; rfqs: number; cost: number }>> {
  const map = new Map<
    string,
    { impressions: number; clicks: number; rfqs: number; cost: number }
  >();
  if (campaignIds.length === 0) return map;
  const { data, error } = await supabase.rpc("featured_metrics_for_campaigns", {
    _campaign_ids: campaignIds,
  });
  if (error) throw error;
  for (const r of data ?? []) {
    map.set(r.campaign_id, {
      impressions: r.impressions ?? 0,
      clicks: r.clicks ?? 0,
      rfqs: r.rfqs ?? 0,
      cost: Number(r.cost ?? 0),
    });
  }
  return map;
}

/**
 * Fetch up to 3 active sponsored packages for a given country (target market).
 * Returns the package_id list to inject at the top of search results.
 */
export async function fetchSponsoredPackagesForCountry(
  countryCode: string | null,
  limit = 3,
): Promise<{ packageId: string; campaignId: string }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const query = supabase
    .from("featured_campaigns")
    .select("id, package_id, target_markets, bid_amount, start_date, end_date, status")
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("bid_amount", { ascending: false })
    .limit(limit * 3);
  const { data } = await query;
  const rows = (data ?? []) as Array<{
    id: string;
    package_id: string;
    target_markets: string[] | null;
  }>;
  const matched = countryCode
    ? rows.filter(
        (r) =>
          !r.target_markets ||
          r.target_markets.length === 0 ||
          r.target_markets.includes(countryCode),
      )
    : rows;
  const seen = new Set<string>();
  const out: { packageId: string; campaignId: string }[] = [];
  for (const r of matched) {
    if (seen.has(r.package_id)) continue;
    seen.add(r.package_id);
    out.push({ packageId: r.package_id, campaignId: r.id });
    if (out.length >= limit) break;
  }
  return out;
}

/** Estimated daily impressions, hardcoded by market for v1. */
export function estimateDailyImpressions(budget: number, bid: number, marketCount: number): number {
  if (bid <= 0) return 0;
  // Naive: budget / bid CPC, capped by per-market reach estimate.
  const fromBudget = Math.floor(budget / Math.max(bid, 0.01));
  const reach = Math.max(marketCount, 1) * 250;
  return Math.min(fromBudget, reach);
}

export const TARGET_MARKETS: { code: string; name: string }[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "PK", name: "Pakistan" },
  { code: "ID", name: "Indonesia" },
  { code: "IN", name: "India" },
  { code: "BD", name: "Bangladesh" },
  { code: "NG", name: "Nigeria" },
  { code: "TR", name: "Türkiye" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "MY", name: "Malaysia" },
  { code: "EG", name: "Egypt" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
];
