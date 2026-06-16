import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PackageCardData } from "@/components/search/PackageCard";
import { fetchActiveCampaignsForPackages } from "@/lib/campaigns";
import { fetchSponsoredPackagesForCountry } from "@/lib/featured";
import { fetchLowStockForPackages } from "@/lib/availability";
import { queryKeys } from "./keys";

const PAGE_SIZE = 20;

export interface PackageSearchFilters {
  city?: string;
  type: "hajj" | "umrah" | "any";
  sort: "best" | "price_asc" | "price_desc" | "rating" | "newest";
  page: number;
  minPrice: number;
  maxPrice: number;
  dateStart: string | null;
  dateEnd: string | null;
  groupSize: number;
  zones: string[];
  meals: string;
  accessibility: boolean;
}

export interface PackageSearchResult {
  rows: PackageCardData[];
  count: number;
}

async function fetchPackageSearch(
  filters: PackageSearchFilters,
): Promise<PackageSearchResult> {
  const isLoadMore = filters.page > 1;
  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Fields: PackageCard payload + agent_id (for badge join) + created_at (sort).
  let query = supabase
    .from("packages")
    .select(
      "id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_zone, distance_to_haram_m, created_at, agent_id, agents!inner(business_name, slug, trust_score, avg_rating, verification_level, avg_response_mins, total_reviews)",
      { count: "exact" },
    )
    .eq("status", "active");

  if (filters.type !== "any") query = query.eq("type", filters.type);
  if (filters.city) query = query.ilike("departure_city", `%${filters.city}%`);
  if (filters.minPrice > 0) query = query.gte("base_price", filters.minPrice);
  if (filters.maxPrice < 10000) query = query.lte("base_price", filters.maxPrice);
  if (filters.dateStart) query = query.gte("date_end", filters.dateStart);
  if (filters.dateEnd) query = query.lte("date_start", filters.dateEnd);
  if (filters.groupSize > 1)
    query = query.or(`group_size_max.gte.${filters.groupSize},group_size_max.is.null`);
  if (filters.zones.length > 0) query = query.in("hotel_zone", filters.zones);
  if (filters.meals !== "any") query = query.eq("meals_included", filters.meals);
  if (filters.accessibility) query = query.eq("accessibility", true);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("base_price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("base_price", { ascending: false, nullsFirst: false });
      break;
    case "newest":
    case "rating":
    case "best":
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PackageCardData[];

  // Hydrate verified badges in a single batched query.
  const agentIds = Array.from(
    new Set(
      rows
        .map((r) => (r as unknown as { agent_id?: string }).agent_id)
        .filter((v): v is string => !!v),
    ),
  );
  if (agentIds.length > 0) {
    // Fields: only agent_id + badge_type to bucket; full type metadata for icon + label.
    const [{ data: badgeRows }, { data: typeRows }] = await Promise.all([
      supabase
        .from("agent_badges")
        .select("agent_id, badge_type")
        .in("agent_id", agentIds)
        .eq("status", "verified"),
      supabase
        .from("badge_types")
        .select("id, name, icon_name, color_hex, authority"),
    ]);
    const typeMap = new Map(
      ((typeRows ?? []) as Array<{ id: string }>).map((t) => [t.id, t]),
    );
    const grouped = new Map<string, { badge_type: string; type: unknown }[]>();
    for (const b of (badgeRows ?? []) as Array<{ agent_id: string; badge_type: string }>) {
      const arr = grouped.get(b.agent_id) ?? [];
      arr.push({ badge_type: b.badge_type, type: typeMap.get(b.badge_type) ?? null });
      grouped.set(b.agent_id, arr);
    }
    for (const r of rows) {
      const aid = (r as unknown as { agent_id?: string }).agent_id;
      if (aid) {
        (r as PackageCardData).verified_badges = (grouped.get(aid) ?? []) as PackageCardData["verified_badges"];
      }
    }
  }

  // Hydrate active campaigns
  const pkgIds = rows.map((r) => r.id);
  const campaignMap = await fetchActiveCampaignsForPackages(pkgIds);
  const lowStockMap = await fetchLowStockForPackages(pkgIds);
  for (const r of rows) {
    r.campaign = campaignMap.get(r.id) ?? null;
    r.low_stock = lowStockMap.get(r.id) ?? null;
  }

  // Inject sponsored packages on first page only.
  let finalRows = rows;
  if (!isLoadMore) {
    const sponsored = await fetchSponsoredPackagesForCountry(null, 3);
    const sponsoredIds = sponsored
      .map((s) => s.packageId)
      .filter((id) => !rows.some((r) => r.id === id));
    if (sponsoredIds.length > 0) {
      const { data: sponsoredRows } = await supabase
        .from("packages")
        .select(
          "id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_zone, distance_to_haram_m, created_at, agent_id, agents!inner(business_name, slug, trust_score, avg_rating, verification_level, avg_response_mins, total_reviews)",
        )
        .in("id", sponsoredIds)
        .eq("status", "active");
      const sRows = ((sponsoredRows ?? []) as unknown as PackageCardData[]).map((r) => ({
        ...r,
        sponsored: true,
      }));
      const sponsoredLowStockMap = await fetchLowStockForPackages(sRows.map((r) => r.id));
      for (const r of sRows) {
        r.low_stock = sponsoredLowStockMap.get(r.id) ?? null;
      }
      finalRows = [...sRows, ...rows];
    }
  }

  return { rows: finalRows, count: count ?? 0 };
}

/** Package search — 2-minute staleTime per spec. */
export const packageSearchQuery = (filters: PackageSearchFilters) =>
  queryOptions({
    queryKey: queryKeys.packages.search(filters),
    queryFn: () => fetchPackageSearch(filters),
    staleTime: 2 * 60 * 1000,
    // search results are paginated separately — keep prior page in memory while
    // the next one loads to avoid the list flickering between pages.
    placeholderData: (prev) => prev,
  });

export function usePackageSearch(filters: PackageSearchFilters) {
  return useQuery(packageSearchQuery(filters));
}

export const PACKAGE_SEARCH_PAGE_SIZE = PAGE_SIZE;
