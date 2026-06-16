import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveCampaignInfo {
  id: string;
  name: string;
  type: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  start_date: string;
  end_date: string;
}

/**
 * Calculates the discounted price for display. Does NOT mutate base_price.
 */
export function applyCampaignDiscount(
  basePrice: number | null,
  campaign: ActiveCampaignInfo | null,
): number | null {
  if (basePrice == null || !campaign) return basePrice;
  if (campaign.discount_type === "percentage") {
    const off = basePrice * (campaign.discount_value / 100);
    return Math.max(0, Math.round((basePrice - off) * 100) / 100);
  }
  return Math.max(0, Math.round((basePrice - campaign.discount_value) * 100) / 100);
}

export function discountLabel(campaign: ActiveCampaignInfo): string {
  if (campaign.discount_type === "percentage") return `${campaign.discount_value}% off`;
  return `${campaign.discount_value} off`;
}

export function formatCountdown(endDate: string): { text: string; urgent: boolean } {
  const end = new Date(endDate + "T23:59:59").getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return { text: "ending soon", urgent: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  if (days >= 1) return { text: `ends in ${days}d ${hours}h`, urgent: days <= 2 };
  if (hours >= 1) return { text: `ends in ${hours}h ${mins}m`, urgent: true };
  return { text: `ends in ${mins}m`, urgent: true };
}

/**
 * Fetches active campaigns and returns a Map keyed by package_id.
 * "Active" = status='active' AND start_date <= today <= end_date.
 */
export async function fetchActiveCampaignsForPackages(
  packageIds: string[],
): Promise<Map<string, ActiveCampaignInfo>> {
  const result = new Map<string, ActiveCampaignInfo>();
  if (packageIds.length === 0) return result;
  const today = new Date().toISOString().slice(0, 10);

  const { data: links } = await supabase
    .from("campaign_packages")
    .select("campaign_id, package_id")
    .in("package_id", packageIds);
  if (!links || links.length === 0) return result;

  const campaignIds = Array.from(new Set(links.map((l) => l.campaign_id)));
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, type, discount_type, discount_value, start_date, end_date, status")
    .in("id", campaignIds)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today);
  if (!campaigns) return result;

  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));
  for (const link of links) {
    const camp = campaignMap.get(link.campaign_id);
    if (camp && !result.has(link.package_id)) {
      result.set(link.package_id, camp as ActiveCampaignInfo);
    }
  }
  return result;
}

/**
 * Live countdown hook - re-renders every minute.
 */
export function useCampaignCountdown(endDate: string | null): { text: string; urgent: boolean } | null {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!endDate) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [endDate]);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  tick;
  return endDate ? formatCountdown(endDate) : null;
}
