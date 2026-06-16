import { supabase } from "@/integrations/supabase/client";

export type SeoFaqItem = { question: string; answer: string };

export type SeoPage = {
  id: string;
  city: string;
  trip_type: "hajj" | "umrah";
  locale: string;
  slug: string;
  title: string;
  meta_description: string;
  hero_image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  agent_count: number;
  faq: SeoFaqItem[];
  status: string;
  updated_at: string;
};

const TRIP_TYPES = ["hajj", "umrah"] as const;

function isTripType(value: string): value is "hajj" | "umrah" {
  return (TRIP_TYPES as readonly string[]).includes(value);
}

function normalizeFaq(raw: unknown): SeoFaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const q = typeof obj.question === "string" ? obj.question : null;
      const a = typeof obj.answer === "string" ? obj.answer : null;
      if (!q || !a) return null;
      return { question: q, answer: a };
    })
    .filter((x): x is SeoFaqItem => x !== null);
}

function rowToSeoPage(row: {
  id: string;
  city: string;
  trip_type: string;
  locale: string;
  slug: string;
  title: string;
  meta_description: string;
  hero_image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  agent_count: number;
  faq: unknown;
  status: string;
  updated_at: string;
}): SeoPage | null {
  if (!isTripType(row.trip_type)) return null;
  return {
    id: row.id,
    city: row.city,
    trip_type: row.trip_type,
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    meta_description: row.meta_description,
    hero_image_url: row.hero_image_url,
    price_min: row.price_min == null ? null : Number(row.price_min),
    price_max: row.price_max == null ? null : Number(row.price_max),
    agent_count: row.agent_count,
    faq: normalizeFaq(row.faq),
    status: row.status,
    updated_at: row.updated_at,
  };
}

export async function recompute_seo_pages() {
  const { error } = await supabase.rpc("recompute_seo_pages");
  if (error) console.error("Failed to recompute SEO pages:", error);
}

// Fields used across the city/trip-type landing page and the index list:
//   id, city, trip_type, locale, slug, title, meta_description, hero_image_url,
//   price_min, price_max, agent_count, faq, status, updated_at.
const SEO_PAGE_COLS =
  "id, city, trip_type, locale, slug, title, meta_description, hero_image_url, price_min, price_max, agent_count, faq, status, updated_at";

type RouteStats = { agentCount: number; priceMin: number | null; priceMax: number | null };

function statsKey(city: string, tripType: string) {
  return `${city.trim().toLowerCase()}|${tripType.toLowerCase()}`;
}

/**
 * Live agent/pricing stats per (city, trip_type), derived directly from active
 * packages owned by active agents. The denormalized seo_pages columns are only
 * refreshed by the recompute_seo_pages RPC, so they go stale the moment an
 * agent adds a package — always prefer these live numbers for display.
 */
async function fetchRouteStats(
  filter?: { city: string; tripType: string },
): Promise<Map<string, RouteStats>> {
  let query = supabase
    .from("packages")
    .select("base_price, type, departure_city, agent_id, agents!inner(id, status)")
    .eq("status", "active")
    .eq("agents.status", "active");
  if (filter) {
    query = query.ilike("departure_city", filter.city).eq("type", filter.tripType.toLowerCase());
  }
  const { data, error } = await query;
  const map = new Map<string, RouteStats>();
  if (error || !data) return map;

  const agentsByKey = new Map<string, Set<string>>();
  for (const row of data as Array<{
    base_price: number | null;
    type: string;
    departure_city: string | null;
    agent_id: string | null;
  }>) {
    if (!row.departure_city || !row.type) continue;
    const key = statsKey(row.departure_city, row.type);
    const existing = map.get(key) ?? { agentCount: 0, priceMin: null, priceMax: null };
    const price = row.base_price == null ? null : Number(row.base_price);
    if (price != null && Number.isFinite(price)) {
      existing.priceMin = existing.priceMin == null ? price : Math.min(existing.priceMin, price);
      existing.priceMax = existing.priceMax == null ? price : Math.max(existing.priceMax, price);
    }
    if (row.agent_id) {
      const set = agentsByKey.get(key) ?? new Set<string>();
      set.add(row.agent_id);
      agentsByKey.set(key, set);
    }
    map.set(key, existing);
  }
  for (const [key, set] of agentsByKey) {
    const stats = map.get(key);
    if (stats) stats.agentCount = set.size;
  }
  return map;
}

function applyStats(page: SeoPage, stats: Map<string, RouteStats>): SeoPage {
  const live = stats.get(statsKey(page.city, page.trip_type));
  if (!live) return { ...page, agent_count: 0 };
  return {
    ...page,
    agent_count: live.agentCount,
    price_min: live.priceMin ?? page.price_min,
    price_max: live.priceMax ?? page.price_max,
  };
}

export async function fetchSeoPage(city: string, tripType: string): Promise<SeoPage | null> {
  if (!isTripType(tripType.toLowerCase())) return null;
  const { data, error } = await supabase
    .from("seo_pages")
    .select(SEO_PAGE_COLS)
    .ilike("city", city)
    .eq("trip_type", tripType.toLowerCase())
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  const page = rowToSeoPage(data);
  if (!page) return null;
  const stats = await fetchRouteStats({ city: page.city, tripType: page.trip_type });
  return applyStats(page, stats);
}

export async function fetchAllSeoPages(): Promise<SeoPage[]> {
  const { data, error } = await supabase
    .from("seo_pages")
    .select(SEO_PAGE_COLS)
    .eq("status", "active")
    .order("city", { ascending: true })
    .range(0, 99);
  if (error || !data) return [];
  const pages = data.map(rowToSeoPage).filter((x): x is SeoPage => x !== null);
  const stats = await fetchRouteStats();
  return pages.map((p) => applyStats(p, stats));
}

export async function fetchTopAgentsForRoute(
  city: string,
  tripType: "hajj" | "umrah",
  limit = 6,
) {
  const { data, error } = await supabase
    .from("packages")
    .select(
      "agent_id, agents:agent_id(id, business_name, slug, trust_score, avg_rating, total_reviews, verification_level, logo_url, city, country_code)",
    )
    .eq("status", "active")
    .ilike("departure_city", city)
    .eq("type", tripType);
  if (error || !data) return [];

  const seen = new Set<string>();
  const agents: NonNullable<(typeof data)[number]["agents"]>[] = [];
  for (const row of data) {
    if (!row.agents || seen.has(row.agent_id)) continue;
    seen.add(row.agent_id);
    agents.push(row.agents);
  }
  agents.sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0));
  return agents.slice(0, limit);
}

const CITY_TO_COUNTRY: Record<string, string> = {
  London: "United Kingdom",
  Birmingham: "United Kingdom",
  Manchester: "United Kingdom",
  Karachi: "Pakistan",
  Lahore: "Pakistan",
  Islamabad: "Pakistan",
  Jakarta: "Indonesia",
  Surabaya: "Indonesia",
  Lagos: "Nigeria",
  Abuja: "Nigeria",
  Dhaka: "Bangladesh",
  Istanbul: "Türkiye",
  Cairo: "Egypt",
  Riyadh: "Saudi Arabia",
  Jeddah: "Saudi Arabia",
  Dubai: "United Arab Emirates",
  "Kuala Lumpur": "Malaysia",
  Paris: "France",
  "New York": "United States",
  Chicago: "United States",
  Houston: "United States",
  Toronto: "Canada",
  Sydney: "Australia",
  Johannesburg: "South Africa",
  Nairobi: "Kenya",
  Casablanca: "Morocco",
  Delhi: "India",
  Mumbai: "India",
  Colombo: "Sri Lanka",
  Doha: "Qatar",
};

export function countryForCity(city: string): string {
  return CITY_TO_COUNTRY[city] ?? "Other";
}
