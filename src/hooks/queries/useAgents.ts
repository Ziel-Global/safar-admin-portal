import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PackageCardData } from "@/components/search/PackageCard";
import type { ReviewListItem } from "@/components/reviews/ReviewsTab";
import type { VerifiedBadgeItem } from "@/components/badges/VerifiedBadgeRow";
import type { BadgeType } from "@/lib/badges";
import type { TrustScoreRow } from "@/lib/trust";
import { queryKeys } from "./keys";

export interface AgentProfile {
  id: string;
  slug: string | null;
  business_name: string;
  bio: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  country_code: string | null;
  avg_rating: number;
  total_reviews: number;
  trust_score: number;
  verification_level: string;
  avg_response_mins: number | null;
  years_active: number;
  specialisations: string[] | null;
}

export interface AvailabilityRow {
  status: "online" | "away";
  auto_reply: string | null;
  return_date: string | null;
}

export interface AgentProfileBundle {
  agent: AgentProfile;
  packages: PackageCardData[];
  reviews: ReviewListItem[];
  badges: VerifiedBadgeItem[];
  availability: AvailabilityRow | null;
  trust: TrustScoreRow | null;
  totalLeads: number;
}

// Reviews page size for both initial bundle + load-more.
export const REVIEWS_PAGE_SIZE = 5;

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------
async function fetchAgent(slug: string): Promise<AgentProfile | null> {
  // Fields: hero card + bio + specialisations columns only.
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, slug, business_name, bio, logo_url, cover_image_url, city, country_code, avg_rating, total_reviews, trust_score, verification_level, avg_response_mins, years_active, specialisations",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data as AgentProfile | null;
}

async function fetchAgentPackages(agentId: string): Promise<PackageCardData[]> {
  // Fields: PackageCard payload only. Capped at 24 to keep the profile lean.
  const { data, error } = await supabase
    .from("packages")
    .select(
      `id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_zone, distance_to_haram_m,
       agents:agent_id ( business_name, slug, trust_score, avg_rating, verification_level, avg_response_mins, total_reviews )`,
    )
    .eq("agent_id", agentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(0, 23);
  if (error) throw error;
  return (data ?? []) as unknown as PackageCardData[];
}

export async function fetchAgentReviewsPage(
  agentId: string,
  from = 0,
  pageSize = REVIEWS_PAGE_SIZE,
): Promise<ReviewListItem[]> {
  // Fields: card-only review fields. Media is fetched separately to avoid the
  // join multiplying rows.
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select(
      "id, overall_rating, dimensions, review_text, created_at, is_verified, is_highlighted, agent_response, agent_responded_at",
    )
    .eq("agent_id", agentId)
    .eq("moderation_status", "approved")
    .order("is_highlighted", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  const reviews = (reviewRows ?? []) as Array<Omit<ReviewListItem, "media">>;
  if (reviews.length === 0) return [];

  // Fields: only thumbnails + lightbox columns.
  const reviewIds = reviews.map((r) => r.id);
  const { data: mediaRows } = await supabase
    .from("review_media")
    .select("id, review_id, url, media_type, thumbnail_url")
    .in("review_id", reviewIds)
    .eq("moderation_status", "approved");

  const mediaByReview = new Map<string, ReviewListItem["media"]>();
  for (const m of (mediaRows ?? []) as Array<{
    id: string;
    review_id: string;
    url: string;
    media_type: string;
    thumbnail_url: string | null;
  }>) {
    const arr = mediaByReview.get(m.review_id) ?? [];
    arr.push({ id: m.id, url: m.url, media_type: m.media_type, thumbnail_url: m.thumbnail_url });
    mediaByReview.set(m.review_id, arr);
  }
  return reviews.map((r) => ({ ...r, media: mediaByReview.get(r.id) ?? [] }));
}

async function fetchAgentBadges(agentId: string): Promise<VerifiedBadgeItem[]> {
  // Fields: badge_type for verified rows + the type metadata for the badge row UI.
  const [{ data: badges }, { data: types }] = await Promise.all([
    supabase
      .from("agent_badges")
      .select("badge_type")
      .eq("agent_id", agentId)
      .eq("status", "verified"),
    supabase
      .from("badge_types")
      .select("id, name, icon_name, color_hex, authority, description, help_url"),
  ]);
  const typeMap = new Map(((types ?? []) as BadgeType[]).map((t) => [t.id, t]));
  return ((badges ?? []) as { badge_type: string }[]).map((b) => ({
    badge_type: b.badge_type,
    type: typeMap.get(b.badge_type) ?? null,
  }));
}

async function fetchAgentExtras(agentId: string) {
  // Fields: availability snapshot, trust row, and a head-only count of leads.
  const [availabilityRes, trustRes, leadsRes] = await Promise.all([
    supabase
      .from("agent_availability")
      .select("status, auto_reply, return_date")
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("trust_scores")
      .select("agent_id, total_score, factors, tips, computed_at")
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
  ]);
  return {
    availability: availabilityRes.data as AvailabilityRow | null,
    trust: trustRes.data as unknown as TrustScoreRow | null,
    totalLeads: leadsRes.count ?? 0,
  };
}

async function fetchAgentBundle(slug: string): Promise<AgentProfileBundle | null> {
  const agent = await fetchAgent(slug);
  if (!agent) return null;
  const [packages, reviews, badges, extras] = await Promise.all([
    fetchAgentPackages(agent.id),
    fetchAgentReviewsPage(agent.id, 0, REVIEWS_PAGE_SIZE),
    fetchAgentBadges(agent.id),
    fetchAgentExtras(agent.id),
  ]);
  return { agent, packages, reviews, badges, ...extras };
}

// ---------------------------------------------------------------------------
// Query options + hook
// ---------------------------------------------------------------------------
/** Full agent profile bundle — 10-minute staleTime per spec. */
export const agentProfileQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.agents.detail(slug),
    queryFn: () => fetchAgentBundle(slug),
    staleTime: 10 * 60 * 1000,
  });

export function useAgentProfile(slug: string) {
  return useQuery(agentProfileQuery(slug));
}

export { fetchAgentBundle };
