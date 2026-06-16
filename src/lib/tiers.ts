export type TierName = "economy" | "standard" | "premium" | "vip";

export const TIER_ORDER: TierName[] = ["economy", "standard", "premium", "vip"];

export const TIER_LABELS: Record<TierName, string> = {
  economy: "Economy",
  standard: "Standard",
  premium: "Premium",
  vip: "VIP",
};

export const TIER_DESCRIPTIONS: Record<TierName, string> = {
  economy: "Best value - comfortable essentials",
  standard: "Balanced comfort and convenience",
  premium: "Closer to Haram, upgraded room",
  vip: "Luxury hotel, private transport",
};

export const TIER_ACCENTS: Record<TierName, string> = {
  economy: "border-border bg-card",
  standard: "border-primary/40 bg-primary/5",
  premium: "border-accent/40 bg-accent/5",
  vip: "border-amber-400/50 bg-amber-50 dark:bg-amber-950/30",
};

export interface PackageTierRecord {
  id: string;
  package_id: string;
  tier_name: TierName;
  hotel_override: string | null;
  zone_override: string | null;
  room_type: string | null;
  transport_override: string | null;
  meal_override: string | null;
  price_adult: number;
  price_child: number | null;
  currency: string;
  description_override: string | null;
  sort_order: number;
  is_highlighted: boolean;
  status: string;
}

export function sortTiers<T extends { tier_name: TierName }>(tiers: T[]): T[] {
  return [...tiers].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier_name) - TIER_ORDER.indexOf(b.tier_name),
  );
}
