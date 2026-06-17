import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import {
  Star,
  ShieldCheck,
  Building2,
  Clock,
  CalendarDays,
  MapPin,
  MessageSquare,
  Award,
  PauseCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPreviewLayout } from "@/components/layout/AdminPreviewLayout";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shimmer } from "@/components/ui/skeletons";
import { PackageCard, PackageCardSkeleton, type PackageCardData } from "@/components/search/PackageCard";
import { ReviewsTab, type ReviewListItem } from "@/components/reviews/ReviewsTab";
import { VerifiedBadgeRow, type VerifiedBadgeItem } from "@/components/badges/VerifiedBadgeRow";
import { TrustFactorsBars, TrustGauge } from "@/components/agent/TrustGauge";
import type { BadgeType } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { trustLabel, countryFlag } from "@/lib/format";
import { responseTimeBadge, type TrustFactors, type TrustScoreRow } from "@/lib/trust";
import { toast } from "sonner";
import { trackPageView } from "@/lib/pageViews";
import { ReportAgentDialog } from "@/components/admin/ReportAgentDialog";
import { fetchLowStockForPackages } from "@/lib/availability";

interface AgentProfile {
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
  status: string;
}

interface AvailabilityRow {
  status: "online" | "away";
  auto_reply: string | null;
  return_date: string | null;
}

async function fetchAgent(slug: string) {
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, slug, business_name, bio, logo_url, cover_image_url, city, country_code, avg_rating, total_reviews, trust_score, verification_level, avg_response_mins, years_active, specialisations, status",
    )
    .eq("slug", slug)
    // Suspended agents still resolve so we can render a clear "suspended" state
    // instead of a 404 (their packages remain hidden by RLS).
    .in("status", ["active", "suspended"])
    .maybeSingle();
  if (error) throw error;
  return data as AgentProfile | null;
}

async function fetchAgentPackages(agentId: string): Promise<PackageCardData[]> {
  // Fields: PackageCard payload only. Capped at 24 to keep the profile lean — agents
  //   with more packages will need a paginated tab in a follow-up.
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
  const rows = (data ?? []) as unknown as PackageCardData[];
  const lowStockMap = await fetchLowStockForPackages(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, low_stock: lowStockMap.get(row.id) ?? null }));
}

// Initial reviews page size — kept small; "Load more" pulls the next page.
export const REVIEWS_PAGE_SIZE = 5;

async function fetchAgentReviews(
  agentId: string,
  from = 0,
  pageSize = REVIEWS_PAGE_SIZE,
): Promise<ReviewListItem[]> {
  // Fields: ReviewsTab card needs id, overall_rating, dimensions, review_text, created_at,
  //   is_verified, is_highlighted, agent_response, agent_responded_at. Media is fetched
  //   separately to avoid an unbounded join multiplying rows.
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

  // Fields: only the columns ReviewsTab renders for thumbnails + lightbox.
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

export async function fetchAgentReviewsPage(agentId: string, from: number, pageSize: number) {
  return fetchAgentReviews(agentId, from, pageSize);
}

async function fetchAgentBadges(agentId: string): Promise<VerifiedBadgeItem[]> {
  // Fields: only badge_type for verified rows; full type metadata for the badge row UI.
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

async function fetchAgentExtras(agentId: string): Promise<{
  availability: AvailabilityRow | null;
  trust: TrustScoreRow | null;
  totalLeads: number;
}> {
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

export const Route = createFileRoute("/agents/$slug")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },
  loader: async ({
    params,
  }): Promise<{
    agent: AgentProfile;
    packages: PackageCardData[];
    reviews: ReviewListItem[];
    badges: VerifiedBadgeItem[];
    availability: AvailabilityRow | null;
    trust: TrustScoreRow | null;
    totalLeads: number;
  }> => {
    const agent = await fetchAgent(params.slug);
    if (!agent) throw notFound();
    const [packages, reviews, badges, extras] = await Promise.all([
      fetchAgentPackages(agent.id),
      fetchAgentReviews(agent.id),
      fetchAgentBadges(agent.id),
      fetchAgentExtras(agent.id),
    ]);
    return { agent, packages, reviews, badges, ...extras };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Agent - Safar" }] };
    const { agent } = loaderData;
    const desc = `${agent.business_name} - verified Hajj & Umrah agent${
      agent.city ? ` based in ${agent.city}` : ""
    }. ${agent.years_active} years active, ${agent.total_reviews} reviews.`;
    const ogImage = agent.cover_image_url ?? agent.logo_url ?? undefined;
    return {
      meta: [
        { title: `${agent.business_name} - Safar` },
        { name: "description", content: desc },
        { property: "og:title", content: `${agent.business_name} - Safar` },
        { property: "og:description", content: desc },
        ...(ogImage ? [{ property: "og:image", content: ogImage }] : []),
        ...(ogImage ? [{ property: "twitter:image", content: ogImage }] : []),
      ],
    };
  },
  pendingComponent: AgentSkeleton,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AdminPreviewLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Couldn't load agent</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          <Button
            className="mt-6"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
        </div>
      </AdminPreviewLayout>
    );
  },
  notFoundComponent: () => (
    <AdminPreviewLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">Agent not found</h1>
        <p className="mt-2 text-muted-foreground">
          This agent may have been removed or is no longer active.
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin">Back to admin</Link>
        </Button>
      </div>
    </AdminPreviewLayout>
  ),
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const { agent, packages, reviews: initialReviews, badges, availability, trust: trustScore, totalLeads } =
    Route.useLoaderData() as {
      agent: AgentProfile;
      packages: PackageCardData[];
      reviews: ReviewListItem[];
      badges: VerifiedBadgeItem[];
      availability: AvailabilityRow | null;
      trust: TrustScoreRow | null;
      totalLeads: number;
    };
  const [reviews, setReviews] = useState<ReviewListItem[]>(initialReviews);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const reviewsHasMore = reviews.length < agent.total_reviews;

  useEffect(() => {
    setReviews(initialReviews);
  }, [initialReviews]);

  const handleLoadMoreReviews = async () => {
    setReviewsLoadingMore(true);
    try {
      const next = await fetchAgentReviewsPage(agent.id, reviews.length, REVIEWS_PAGE_SIZE);
      setReviews((prev) => [...prev, ...next]);
    } finally {
      setReviewsLoadingMore(false);
    }
  };

  useEffect(() => {
    trackPageView("agent", agent.id);
  }, [agent.id]);

  const trust = trustLabel(agent.trust_score, agent.verification_level);
  const flag = countryFlag(agent.country_code);
  const responseChip = responseTimeBadge(agent.avg_response_mins, totalLeads);
  const isAway = availability?.status === "away";
  const isSuspended = agent.status === "suspended";

  const onRequestQuote = () => {
    toast.success("Quote requested", {
      description: `${agent.business_name} will be in touch shortly.`,
    });
  };

  return (
    <AdminPreviewLayout>
      <div className="mx-auto max-w-7xl px-4 pb-32 sm:px-6 lg:px-8 lg:pb-12">
        {isSuspended ? (
          <div className="relative z-10 -mt-12 mb-4 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 shadow-sm">
            <PauseCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">This agent is currently suspended</p>
              <p className="mt-1 text-sm text-rose-800/90">
                Their packages are not available for booking while the suspension is in effect.
              </p>
            </div>
          </div>
        ) : null}
        {/* Profile card */}
        <div className="relative z-10 mt-6 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="grid h-24 w-24 shrink-0 place-content-center overflow-hidden rounded-2xl border-4 border-card bg-primary/10 text-primary shadow-md sm:h-28 sm:w-28">
              {agent.logo_url ? (
                <OptimizedImage
                  src={agent.logo_url}
                  alt={agent.business_name}
                  size="avatar"
                  eager
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-10 w-10" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {agent.business_name}
                </h1>
                {flag ? <span className="text-2xl">{flag}</span> : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {agent.avg_rating > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground/80">
                      {agent.avg_rating.toFixed(1)}
                    </span>
                    <span>({agent.total_reviews} reviews)</span>
                  </span>
                ) : (
                  <span>No reviews yet</span>
                )}
                {agent.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {agent.city}
                  </span>
                ) : null}
                {agent.years_active > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" /> {agent.years_active}y active
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    responseChip.className,
                  )}
                >
                  <Clock className="h-3.5 w-3.5" /> {responseChip.label}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                    trust.className,
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> {trust.label}
                </span>
                {agent.specialisations?.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium capitalize"
                  >
                    {s}
                  </span>
                ))}
                {badges.length > 0 ? (
                  <VerifiedBadgeRow items={badges} size="sm" className="ml-1" />
                ) : null}
                {isAway ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    <PauseCircle className="h-3.5 w-3.5" />
                    Away
                    {availability?.return_date
                      ? ` until ${new Date(availability.return_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                      : ""}
                  </span>
                ) : null}
              </div>

              {isAway && availability?.auto_reply ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Auto-reply from {agent.business_name}</p>
                  <p className="mt-1 italic">"{availability.auto_reply}"</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end sm:self-center">
              {!isSuspended ? (
                <Button onClick={onRequestQuote} size="lg" className="w-full sm:w-auto">
                  <MessageSquare className="h-4 w-4" /> Request Quote
                </Button>
              ) : null}
              <ReportAgentDialog agentId={agent.id} agentName={agent.business_name} />
            </div>

          </div>
        </div>

        <Tabs defaultValue="packages" className="mt-8">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="trust">Trust</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="guides">Guides & Tips</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="mt-6">
            {isSuspended ? (
              <EmptyState
                title="Packages unavailable"
                desc="This agent is suspended, so their packages are currently hidden."
              />
            ) : packages.length === 0 ? (
              <EmptyState
                title="No active packages yet"
                desc="This agent hasn't published any packages."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((p) => (
                  <PackageCard key={p.id} pkg={p} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <ReviewsTab
              reviews={reviews}
              avgRating={agent.avg_rating}
              totalReviews={agent.total_reviews}
              onLoadMore={handleLoadMoreReviews}
              loadingMore={reviewsLoadingMore}
              hasMore={reviewsHasMore}
            />
          </TabsContent>

          <TabsContent value="trust" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <TrustGauge score={trustScore?.total_score ?? agent.trust_score ?? 0} size={160} />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">Trust score</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Calculated from reviews, response speed, years active, verified credentials, and complaint record.
                  </p>
                  <TrustFactorsBars
                    factors={
                      (trustScore?.factors as TrustFactors) ?? {
                        reviews: 0,
                        response: 0,
                        years: 0,
                        verification: 0,
                        complaints: 0,
                      }
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="credentials" className="mt-6">
            <EmptyState
              icon={<Award className="h-6 w-6" />}
              title="Credentials coming soon"
              desc="Licenses, certifications, and verifications will be listed here."
            />
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-lg font-semibold">About {agent.business_name}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {agent.bio ||
                  `${agent.business_name} is a verified Hajj & Umrah travel agent on Safar. More information coming soon.`}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile sticky bar */}
      {!isSuspended ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
          <Button onClick={onRequestQuote} size="lg" className="w-full">
            <MessageSquare className="h-4 w-4" /> Request Quote
          </Button>
        </div>
      ) : null}

    </AdminPreviewLayout>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      {icon ? (
        <div className="mb-3 grid h-12 w-12 place-content-center rounded-full bg-secondary text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function AgentSkeleton() {
  return (
    <AdminPreviewLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Shimmer className="mt-6 h-44 rounded-2xl" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AdminPreviewLayout>
  );
}
