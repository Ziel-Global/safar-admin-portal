import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import {
  Star,
  ShieldCheck,
  MapPin,
  Calendar,
  Users,
  Plane,
  Utensils,
  CheckCircle2,
  XCircle,
  Accessibility,
  Building2,
  ArrowRight,
  MessageSquare,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPreviewLayout } from "@/components/layout/AdminPreviewLayout";
import { PackageGallery } from "@/components/packages/PackageGallery";
import { PriceAlertButton } from "@/components/packages/PriceAlertButton";
import { TierComparisonStrip } from "@/components/packages/TierComparisonStrip";
import { AvailabilityDatePicker } from "@/components/packages/AvailabilityDatePicker";
import type { LightboxMedia } from "@/components/packages/MediaLightbox";
import { sortTiers, type PackageTierRecord } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shimmer } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";
import { formatPrice, trustLabel, ZONE_STYLES } from "@/lib/format";
import { useFormatPrice } from "@/contexts/CurrencyContext";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import { useWatchlist } from "@/lib/watchlist";
import { usePriceAlerts } from "@/lib/priceAlerts";
import { toast } from "sonner";
import { trackPageView } from "@/lib/pageViews";
import {
  applyCampaignDiscount,
  discountLabel,
  fetchActiveCampaignsForPackages,
  type ActiveCampaignInfo,
} from "@/lib/campaigns";
import { fetchLowStockForPackages } from "@/lib/availability";

interface AgentLite {
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

interface PackageDetail {
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
  agents: AgentLite | null;
}

async function fetchPackage(slug: string) {
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
  const { data, error } = await supabase
    .from("package_tiers")
    .select("*")
    .eq("package_id", packageId)
    .eq("status", "active");
  if (error) throw error;
  return sortTiers((data ?? []) as PackageTierRecord[]);
}

export const Route = createFileRoute("/packages/$slug")({
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
  loader: async ({ params }) => {
    const pkg = await fetchPackage(params.slug);
    if (!pkg) throw notFound();
    const [media, tiers, campaignMap, lowStockMap] = await Promise.all([
      fetchMedia(pkg.id),
      fetchTiers(pkg.id),
      fetchActiveCampaignsForPackages([pkg.id]),
      fetchLowStockForPackages([pkg.id]),
    ]);
    const campaign = campaignMap.get(pkg.id) ?? null;
    const lowStock = lowStockMap.get(pkg.id) ?? null;
    return { pkg, media, tiers, campaign, lowStock };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Package - Safar" }] };
    const { pkg } = loaderData;
    const desc = `${pkg.title} from ${pkg.departure_city}. ${
      pkg.hotel_name ? `Stay at ${pkg.hotel_name}. ` : ""
    }${pkg.base_price ? `From ${formatPrice(pkg.base_price, pkg.currency)} per person.` : ""}`.trim();
    const ogImage = pkg.thumbnail_url ?? undefined;
    return {
      meta: [
        { title: `${pkg.title} - Safar` },
        { name: "description", content: desc },
        { property: "og:title", content: `${pkg.title} - Safar` },
        { property: "og:description", content: desc },
        ...(ogImage ? [{ property: "og:image", content: ogImage }] : []),
        ...(ogImage ? [{ property: "twitter:image", content: ogImage }] : []),
      ],
    };
  },
  pendingComponent: PackageDetailSkeleton,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AdminPreviewLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Couldn't load package</h1>
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
        <h1 className="text-3xl font-bold">Package not found</h1>
        <p className="mt-2 text-muted-foreground">
          This package may have been removed or is no longer available.
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin">Back to admin</Link>
        </Button>
      </div>
    </AdminPreviewLayout>
  ),
  component: PackageDetailPage,
});

function PackageDetailPage() {
  const { pkg, media, tiers, campaign, lowStock } = Route.useLoaderData() as {
    pkg: PackageDetail;
    media: LightboxMedia[];
    tiers: PackageTierRecord[];
    campaign: ActiveCampaignInfo | null;
    lowStock: number | null;
  };
  const [showStickyTop, setShowStickyTop] = useState(false);
  const { has, toggle } = useWatchlist();
  const { activePackageIds, refresh: refreshAlerts } = usePriceAlerts();
  const fmt = useFormatPrice();
  const saved = has(pkg.id);
  const hasAlert = activePackageIds.has(pkg.id);
  const fromAmount = tiers.length > 0 ? Math.min(...tiers.map((t) => t.price_adult)) : pkg.base_price;
  const discountedFromAmount = applyCampaignDiscount(fromAmount, campaign);
  const hasDiscount =
    campaign != null && discountedFromAmount != null && fromAmount != null && discountedFromAmount < fromAmount;
  const discountedBasePrice = applyCampaignDiscount(pkg.base_price, campaign);
  const baseHasDiscount =
    campaign != null && discountedBasePrice != null && pkg.base_price != null && discountedBasePrice < pkg.base_price;

  useEffect(() => {
    const onScroll = () => setShowStickyTop(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    trackPageView("package", pkg.id);
  }, [pkg.id]);

  const onRequestQuote = () => {
    toast.success("Quote requested", {
      description: `We'll connect you with ${pkg.agents?.business_name ?? "the agent"} shortly.`,
    });
  };

  const trust = pkg.agents
    ? trustLabel(pkg.agents.trust_score, pkg.agents.verification_level)
    : null;

  return (
    <AdminPreviewLayout>
      {/* Sticky scroll-triggered "Request Quote" bar (desktop) */}
      <div
        className={cn(
          "fixed left-0 right-0 top-16 z-30 hidden border-b border-border bg-background/95 shadow-sm backdrop-blur transition-transform duration-300 md:block",
          showStickyTop ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{pkg.title}</p>
            <p className="text-xs text-muted-foreground">
              {pkg.agents?.business_name} · From{" "}
              {baseHasDiscount ? (
                <>
                  <span className="font-semibold text-primary">
                    {fmt(discountedBasePrice, pkg.currency)}
                  </span>{" "}
                  <span className="line-through">{fmt(pkg.base_price, pkg.currency)}</span>
                </>
              ) : (
                fmt(pkg.base_price, pkg.currency)
              )}
            </p>
          </div>
          <Button onClick={onRequestQuote}>Request Quote</Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <PackageGallery media={media} />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main content */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-semibold uppercase tracking-wide text-primary">
                {pkg.type}
              </span>
              {pkg.hotel_zone ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold",
                    ZONE_STYLES[pkg.hotel_zone] ?? "bg-secondary border-border",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Zone {pkg.hotel_zone}
                </span>
              ) : null}
              {pkg.hotel_stars ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 font-semibold">
                  {Array.from({ length: pkg.hotel_stars }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </span>
              ) : null}
              {pkg.accessibility ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 font-semibold text-foreground/80">
                  <Accessibility className="h-3.5 w-3.5" /> Accessible
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{pkg.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Plane className="h-4 w-4" /> From {pkg.departure_city}
              </span>
              {pkg.date_start && pkg.date_end ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(pkg.date_start).toLocaleDateString()} →{" "}
                  {new Date(pkg.date_end).toLocaleDateString()}
                </span>
              ) : null}
              {pkg.group_size_min && pkg.group_size_max ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {pkg.group_size_min}-{pkg.group_size_max} pilgrims
                </span>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm text-muted-foreground">
                      {tiers.length > 0 ? "From" : ""}
                    </span>
                    <PriceDisplay
                      amount={hasDiscount ? discountedFromAmount : fromAmount}
                      currency={pkg.currency}
                      className="text-3xl font-bold text-primary"
                    />
                    {hasDiscount ? (
                      <PriceDisplay
                        amount={fromAmount}
                        currency={pkg.currency}
                        className="text-base font-medium text-muted-foreground line-through"
                        showOriginalTooltip={false}
                      />
                    ) : null}
                    <span className="text-sm text-muted-foreground">per person</span>
                  </div>
                  {campaign ? (
                    <p className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {campaign.name} · {discountLabel(campaign)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Final price confirmed by the agent after your enquiry.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <PriceAlertButton
                    packageId={pkg.id}
                    currentPrice={pkg.base_price}
                    currency={pkg.currency}
                    hasAlert={hasAlert}
                    onCreated={refreshAlerts}
                    className="border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => toggle(pkg.id, pkg.base_price)}
                    aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
                    className="grid h-9 w-9 place-content-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-secondary"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        saved ? "fill-rose-500 text-rose-500" : "text-foreground/70",
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Check availability
                </p>
                {lowStock != null && lowStock > 0 ? (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    Only {lowStock} spot{lowStock === 1 ? "" : "s"} left on the next available date
                  </div>
                ) : null}
                <AvailabilityDatePicker
                  packageId={pkg.id}
                  currency={pkg.currency}
                  basePrice={pkg.base_price}
                />
              </div>
            </div>

            <TierComparisonStrip
              tiers={tiers}
              basePackage={{
                hotel_name: pkg.hotel_name,
                transport_type: pkg.transport_type,
                meals_included: pkg.meals_included,
                hotel_zone: pkg.hotel_zone,
              }}
              onRequestQuote={onRequestQuote}
            />


            <Tabs defaultValue="overview" className="mt-8">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="inclusions">Inclusions</TabsTrigger>
                <TabsTrigger value="hotel">Hotel</TabsTrigger>
                <TabsTrigger value="terms">Terms</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-4 text-sm leading-relaxed">
                <h2 className="text-lg font-semibold">About this package</h2>
                <p className="text-muted-foreground">
                  A curated {pkg.type} package departing from {pkg.departure_city},{" "}
                  {pkg.departure_country}. Stay near the Haram with a trusted, verified agent and
                  a clear, all-in itinerary.
                </p>
                <h3 className="pt-2 font-semibold">Highlights</h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    pkg.hotel_name ? `${pkg.hotel_name} hotel` : null,
                    pkg.distance_to_haram_m ? `${pkg.distance_to_haram_m}m to Haram` : null,
                    pkg.meals_included ? `${pkg.meals_included} board meals` : null,
                    pkg.transport_type ? `${pkg.transport_type} transport` : null,
                    pkg.visa_included ? "Visa included" : null,
                    pkg.accessibility ? "Accessibility supported" : null,
                  ]
                    .filter(Boolean)
                    .map((h) => (
                      <li
                        key={h as string}
                        className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>{h}</span>
                      </li>
                    ))}
                </ul>
              </TabsContent>

              <TabsContent value="inclusions" className="mt-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 font-semibold">What's included</h3>
                    <ul className="space-y-2 text-sm">
                      {[
                        pkg.visa_included ? "Visa processing" : null,
                        pkg.hotel_name ? `${pkg.hotel_name} accommodation` : "Accommodation",
                        pkg.meals_included && pkg.meals_included !== "self"
                          ? `${pkg.meals_included} board meals`
                          : null,
                        pkg.transport_type && pkg.transport_type !== "self"
                          ? `${pkg.transport_type} ground transport`
                          : null,
                        "Group leader / guide",
                      ]
                        .filter(Boolean)
                        .map((x) => (
                          <li key={x as string} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{x}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-3 font-semibold">Not included</h3>
                    <ul className="space-y-2 text-sm">
                      {[
                        !pkg.visa_included ? "Visa fees" : null,
                        pkg.meals_included === "self" ? "Meals" : null,
                        pkg.transport_type === "self" ? "Local transport" : null,
                        "Personal expenses",
                        "Travel insurance",
                      ]
                        .filter(Boolean)
                        .map((x) => (
                          <li key={x as string} className="flex items-start gap-2 text-muted-foreground">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                            <span>{x}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="hotel" className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoRow icon={<Building2 />} label="Hotel" value={pkg.hotel_name ?? "-"} />
                  <InfoRow
                    icon={<Star />}
                    label="Rating"
                    value={pkg.hotel_stars ? `${pkg.hotel_stars} stars` : "-"}
                  />
                  <InfoRow
                    icon={<MapPin />}
                    label="Zone"
                    value={pkg.hotel_zone ? `Zone ${pkg.hotel_zone}` : "-"}
                  />
                  <InfoRow
                    icon={<MapPin />}
                    label="Distance to Haram"
                    value={pkg.distance_to_haram_m ? `${pkg.distance_to_haram_m}m` : "-"}
                  />
                  <InfoRow
                    icon={<Utensils />}
                    label="Meals"
                    value={pkg.meals_included ? `${pkg.meals_included} board` : "-"}
                  />
                  <InfoRow
                    icon={<Plane />}
                    label="Transport"
                    value={pkg.transport_type ?? "-"}
                  />
                </div>
                <div className="flex aspect-[16/7] w-full items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground">
                  Map preview coming soon
                </div>
              </TabsContent>

              <TabsContent value="terms" className="mt-6 space-y-4 text-sm leading-relaxed">
                <div>
                  <h3 className="mb-2 font-semibold">Cancellation policy</h3>
                  <p className="text-muted-foreground">
                    Free cancellation up to 60 days before departure. Within 60 days, the deposit
                    is non-refundable. Within 30 days, full payment is non-refundable. Specific
                    terms confirmed by the agent at booking.
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Payment schedule</h3>
                  <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                    <li>20% deposit to confirm your booking</li>
                    <li>40% due 90 days before departure</li>
                    <li>Remaining balance due 30 days before departure</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Agent sidebar */}
          {pkg.agents ? (
            <aside className="lg:sticky lg:top-20 lg:h-fit">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-content-center overflow-hidden rounded-full bg-primary/10 text-primary">
                    {pkg.agents.logo_url ? (
                      <OptimizedImage
                        src={pkg.agents.logo_url}
                        alt={pkg.agents.business_name}
                        size="avatar"
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{pkg.agents.business_name}</p>
                    {pkg.agents.avg_rating > 0 ? (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-foreground/80">
                          {pkg.agents.avg_rating.toFixed(1)}
                        </span>
                        <span>({pkg.agents.total_reviews} reviews)</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No reviews yet</p>
                    )}
                  </div>
                </div>

                {trust ? (
                  <div className="mt-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                        trust.className,
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {trust.label}
                    </span>
                  </div>
                ) : null}

                {pkg.agents.avg_response_mins ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Typically replies in ~{pkg.agents.avg_response_mins} min
                  </p>
                ) : null}

                <div className="mt-5 space-y-2">
                  <Button onClick={onRequestQuote} className="w-full" size="lg">
                    <MessageSquare className="h-4 w-4" /> Request Quote
                  </Button>
                  {pkg.agents.slug ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/agents/$slug" params={{ slug: pkg.agents.slug }}>
                        View Agent Profile <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      {/* Sticky mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">From</p>
            <div className="flex items-baseline gap-1.5">
              <PriceDisplay
                amount={baseHasDiscount ? discountedBasePrice : pkg.base_price}
                currency={pkg.currency}
                className="text-lg font-bold text-primary"
              />
              {baseHasDiscount ? (
                <PriceDisplay
                  amount={pkg.base_price}
                  currency={pkg.currency}
                  className="text-xs font-medium text-muted-foreground line-through"
                  showOriginalTooltip={false}
                />
              ) : null}
            </div>
          </div>
          <Button onClick={onRequestQuote} size="lg" className="flex-1">
            Request Quote
          </Button>
        </div>
      </div>
    </AdminPreviewLayout>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span className="grid h-8 w-8 shrink-0 place-content-center rounded-md bg-secondary text-foreground/70 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold capitalize">{value}</p>
      </div>
    </div>
  );
}

function PackageDetailSkeleton() {
  return (
    <AdminPreviewLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Shimmer className="aspect-[16/9] w-full rounded-2xl" />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Shimmer className="h-6 w-32" />
            <Shimmer className="h-10 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
            <Shimmer className="h-32 w-full rounded-xl" />
            <Shimmer className="h-64 w-full rounded-xl" />
          </div>
          <Shimmer className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </AdminPreviewLayout>
  );
}
