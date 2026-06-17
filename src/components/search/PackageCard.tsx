import { Link } from "@tanstack/react-router";
import { Heart, Star, MapPin, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import { useWatchlist } from "@/lib/watchlist";
import { usePriceAlerts } from "@/lib/priceAlerts";
import { PriceAlertButton } from "@/components/packages/PriceAlertButton";
import { VerifiedBadgeRow, type VerifiedBadgeItem } from "@/components/badges/VerifiedBadgeRow";
import { responseTimeBadge } from "@/lib/trust";
import { Clock } from "lucide-react";
import { CampaignRibbon } from "@/components/packages/CampaignRibbon";
import { applyCampaignDiscount, type ActiveCampaignInfo } from "@/lib/campaigns";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import { OptimizedImage } from "@/components/ui/optimized-image";

export interface PackageCardData {
  id: string;
  slug: string | null;
  title: string;
  thumbnail_url: string | null;
  base_price: number | null;
  currency: string;
  hotel_name: string | null;
  hotel_zone: string | null;
  distance_to_haram_m: number | null;
  agents: {
    business_name: string;
    slug: string | null;
    trust_score: number;
    avg_rating: number;
    verification_level: string;
    avg_response_mins?: number | null;
    total_reviews?: number;
  } | null;
  verified_badges?: VerifiedBadgeItem[];
  campaign?: ActiveCampaignInfo | null;
  sponsored?: boolean;
  low_stock?: number | null;
}

const ZONE_STYLES: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-amber-100 text-amber-800 border-amber-300",
  C: "bg-rose-100 text-rose-800 border-rose-300",
};

function trustLabel(score: number, level: string): { label: string; className: string } {
  if (score >= 80 || level === "gold" || level === "platinum") {
    return { label: "Highly Trusted", className: "bg-primary/10 text-primary border-primary/30" };
  }
  if (score >= 50 || level === "silver") {
    return { label: "Trusted", className: "bg-accent/15 text-accent-foreground border-accent/40" };
  }
  return { label: "New", className: "bg-secondary text-foreground/70 border-border" };
}

export function PackageCard({
  pkg,
  selected,
  onToggleSelect,
  selectDisabled,
  eager = false,
}: {
  pkg: PackageCardData;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectDisabled?: boolean;
  /** Set true for above-the-fold cards (first 4-6 in a list) so the image loads eagerly. */
  eager?: boolean;
}) {
  const { has, toggle } = useWatchlist();
  const { activePackageIds, refresh: refreshAlerts } = usePriceAlerts();
  const saved = has(pkg.id);
  const hasAlert = activePackageIds.has(pkg.id);
  const trust = pkg.agents
    ? trustLabel(pkg.agents.trust_score, pkg.agents.verification_level)
    : null;
  const responseChip = pkg.agents
    ? responseTimeBadge(pkg.agents.avg_response_mins ?? null, pkg.agents.total_reviews ?? 0)
    : null;
  const campaign = pkg.campaign ?? null;
  const discountedPrice = applyCampaignDiscount(pkg.base_price, campaign);
  const hasDiscount =
    campaign != null &&
    discountedPrice != null &&
    pkg.base_price != null &&
    discountedPrice < pkg.base_price;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      {pkg.slug ? (
        <Link
          to="/packages/$slug"
          params={{ slug: pkg.slug }}
          aria-label={pkg.title}
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">View {pkg.title}</span>
        </Link>
      ) : null}
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {pkg.sponsored ? (
          <span className="absolute left-3 bottom-3 z-10 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur">
            Sponsored
          </span>
        ) : null}
        {campaign ? <CampaignRibbon campaign={campaign} /> : null}
        <OptimizedImage
          src={pkg.thumbnail_url}
          alt={pkg.title}
          size="card"
          eager={eager}
          wrapperClassName="absolute inset-0 h-full w-full"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15 text-muted-foreground">
              <MapPin className="h-8 w-8" />
            </div>
          }
        />
        {onToggleSelect ? (
          <label
            className={cn(
              "absolute left-3 z-20 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition-colors hover:bg-background",
              campaign ? "top-12" : "top-3",
              selectDisabled && !selected ? "opacity-60" : "",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={!!selected}
              disabled={selectDisabled && !selected}
              onCheckedChange={() => onToggleSelect(pkg.id)}
              aria-label={selected ? "Remove from comparison" : "Add to comparison"}
            />
            <span className="text-foreground/80">Compare</span>
          </label>
        ) : null}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <PriceAlertButton
            packageId={pkg.id}
            currentPrice={pkg.base_price}
            currency={pkg.currency}
            hasAlert={hasAlert}
            onCreated={refreshAlerts}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggle(pkg.id, pkg.base_price);
            }}
            aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
            className="grid h-9 w-9 place-content-center rounded-full bg-background/95 shadow-sm backdrop-blur transition-colors hover:bg-background"
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

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">{pkg.title}</h3>
        </div>

        {pkg.agents ? (
          <div className="relative z-20 mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {pkg.agents.slug ? (
              <Link
                to="/agents/$slug"
                params={{ slug: pkg.agents.slug }}
                className="font-medium text-foreground/80 transition-colors hover:text-primary hover:underline"
                aria-label={`View ${pkg.agents.business_name} profile`}
              >
                {pkg.agents.business_name}
              </Link>
            ) : (
              <span className="font-medium text-foreground/80">{pkg.agents.business_name}</span>
            )}
            {trust ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                  trust.className,
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {trust.label}
              </span>
            ) : null}
            {pkg.verified_badges && pkg.verified_badges.length > 0 ? (
              <VerifiedBadgeRow items={pkg.verified_badges} size="sm" />
            ) : null}
            {responseChip ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                  responseChip.className,
                )}
              >
                <Clock className="h-3 w-3" />
                {responseChip.label}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {pkg.hotel_name ? (
            <span className="font-medium text-foreground/70">{pkg.hotel_name}</span>
          ) : null}
          {pkg.hotel_zone ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
                ZONE_STYLES[pkg.hotel_zone] ?? "bg-secondary border-border",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Zone {pkg.hotel_zone}
            </span>
          ) : null}
          {pkg.low_stock != null && pkg.low_stock > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Only {pkg.low_stock} spot{pkg.low_stock === 1 ? "" : "s"} left
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {pkg.agents && pkg.agents.avg_rating > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground/80">
                {pkg.agents.avg_rating.toFixed(1)}
              </span>
            </span>
          ) : null}
          {pkg.distance_to_haram_m != null ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {pkg.distance_to_haram_m}m to Haram
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1">
            {hasDiscount ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <PriceDisplay
                  amount={discountedPrice}
                  currency={pkg.currency}
                  className="text-xl font-bold text-primary break-words"
                />
                <PriceDisplay
                  amount={pkg.base_price}
                  currency={pkg.currency}
                  className="text-xs font-medium text-muted-foreground line-through break-words"
                  showOriginalTooltip={false}
                />
              </div>
            ) : (
              <PriceDisplay
                amount={pkg.base_price}
                currency={pkg.currency}
                className="text-xl font-bold text-primary break-words"
              />
            )}
            <div className="text-[11px] text-muted-foreground">per person</div>
          </div>
          {pkg.slug ? (
            <Link
              to="/packages/$slug"
              params={{ slug: pkg.slug }}
              className="relative z-20 shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline"
            >
              View details
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { PackageCardSkeleton } from "@/components/ui/skeletons";
