import { Star, Hotel, BedDouble, Bus, Utensils, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import {
  TIER_LABELS,
  TIER_DESCRIPTIONS,
  TIER_ACCENTS,
  sortTiers,
  type PackageTierRecord,
} from "@/lib/tiers";

interface Props {
  tiers: PackageTierRecord[];
  basePackage: {
    hotel_name: string | null;
    transport_type: string | null;
    meals_included: string | null;
    hotel_zone: string | null;
  };
  onRequestQuote: (tier: PackageTierRecord) => void;
}

export function TierComparisonStrip({ tiers, basePackage, onRequestQuote }: Props) {
  if (tiers.length === 0) return null;
  const sorted = sortTiers(tiers.filter((t) => t.status === "active"));

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">Choose your tier</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((tier) => {
          const hotel = tier.hotel_override ?? basePackage.hotel_name ?? "-";
          const transport = tier.transport_override ?? basePackage.transport_type ?? "-";
          const meals = tier.meal_override ?? basePackage.meals_included ?? "-";
          return (
            <div
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-xl border p-4 transition",
                TIER_ACCENTS[tier.tier_name],
                tier.is_highlighted && "ring-2 ring-primary",
              )}
            >
              {tier.is_highlighted && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow">
                  <Star className="h-3 w-3 fill-current" /> Most Popular
                </span>
              )}
              <h3 className="text-base font-bold">{TIER_LABELS[tier.tier_name]}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {tier.description_override ?? TIER_DESCRIPTIONS[tier.tier_name]}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <PriceDisplay
                  amount={tier.price_adult}
                  currency={tier.currency}
                  className="text-2xl font-bold text-primary"
                />
                <span className="text-xs text-muted-foreground">/ adult</span>
              </div>
              {tier.price_child != null && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <PriceDisplay
                    amount={tier.price_child}
                    currency={tier.currency}
                    showOriginalTooltip={false}
                  />{" "}
                  / child
                </p>
              )}

              <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
                <li className="flex items-start gap-2">
                  <Hotel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{hotel}</span>
                </li>
                {tier.room_type && (
                  <li className="flex items-start gap-2">
                    <BedDouble className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{tier.room_type}</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Bus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="capitalize">{transport}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Utensils className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="capitalize">{meals === "-" ? "-" : `${meals} board`}</span>
                </li>
              </ul>

              <Button
                size="sm"
                variant={tier.is_highlighted ? "default" : "outline"}
                className="mt-4 w-full"
                onClick={() => onRequestQuote(tier)}
              >
                Request Quote <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
