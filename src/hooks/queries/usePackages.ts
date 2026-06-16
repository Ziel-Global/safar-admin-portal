import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortTiers, type PackageTierRecord } from "@/lib/tiers";
import type { LightboxMedia } from "@/components/packages/MediaLightbox";
import { queryKeys } from "./keys";

// ---------------------------------------------------------------------------
// Types — re-declared locally so consumers aren't coupled to route files.
// ---------------------------------------------------------------------------
export interface PackageDetailAgent {
  id: string;
  slug: string | null;
  business_name: string;
  logo_url: string | null;
  avg_rating: number;
  total_reviews: number;
  trust_score: number;
  verification_level: string;
  avg_response_mins: number | null;
  city: string | null;
  country_code: string | null;
}

export interface PackageDetail {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  status: string;
  base_price: number | null;
  currency: string;
  hotel_name: string | null;
  hotel_stars: number | null;
  hotel_zone: string | null;
  distance_to_haram_m: number | null;
  meals_included: string | null;
  transport_type: string | null;
  visa_included: boolean;
  accessibility: boolean;
  group_size_min: number | null;
  group_size_max: number | null;
  date_start: string | null;
  date_end: string | null;
  departure_city: string;
  departure_country: string;
  thumbnail_url: string | null;
  agents: PackageDetailAgent | null;
}

export interface PackageDetailBundle {
  pkg: PackageDetail;
  media: LightboxMedia[];
  tiers: PackageTierRecord[];
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------
async function fetchPackage(slug: string): Promise<PackageDetail | null> {
  // Fields: full detail page payload + nested agent fields needed for trust pill.
  const { data, error } = await supabase
    .from("packages")
    .select(
      `id, slug, title, type, status, base_price, currency, hotel_name, hotel_stars, hotel_zone, distance_to_haram_m, meals_included, transport_type, visa_included, accessibility, group_size_min, group_size_max, date_start, date_end, departure_city, departure_country, thumbnail_url,
       agents:agent_id ( id, slug, business_name, logo_url, avg_rating, total_reviews, trust_score, verification_level, avg_response_mins, city, country_code )`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data as PackageDetail | null;
}

async function fetchMedia(packageId: string): Promise<LightboxMedia[]> {
  // Fields: gallery only renders url, media_type, label, sort_order, is_primary.
  const { data, error } = await supabase
    .from("package_media")
    .select("url, media_type, label, sort_order, is_primary, moderation_status")
    .eq("package_id", packageId)
    .eq("moderation_status", "approved")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LightboxMedia[];
}

async function fetchTiers(packageId: string): Promise<PackageTierRecord[]> {
  // Fields: tiers strip needs every column for overrides + price calc, kept as *.
  const { data, error } = await supabase
    .from("package_tiers")
    .select("*")
    .eq("package_id", packageId)
    .eq("status", "active");
  if (error) throw error;
  return sortTiers((data ?? []) as PackageTierRecord[]);
}

async function fetchPackageBundle(slug: string): Promise<PackageDetailBundle | null> {
  const pkg = await fetchPackage(slug);
  if (!pkg) return null;
  const [media, tiers] = await Promise.all([fetchMedia(pkg.id), fetchTiers(pkg.id)]);
  return { pkg, media, tiers };
}

// ---------------------------------------------------------------------------
// Query options + hook
// ---------------------------------------------------------------------------
/** Package detail — 10-minute staleTime per spec. */
export const packageDetailQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.packages.detail(slug),
    queryFn: () => fetchPackageBundle(slug),
    staleTime: 10 * 60 * 1000,
  });

export function usePackageDetail(slug: string) {
  return useQuery(packageDetailQuery(slug));
}

// Re-exported for hover prefetch helpers later.
export { fetchPackageBundle };
