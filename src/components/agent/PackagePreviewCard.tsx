import { MapPin, Calendar, Hotel, Utensils, Bus, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PackageDraft {
  title: string;
  type: "hajj" | "umrah" | "";
  departure_city: string;
  departure_country: string;
  date_start: string;
  date_end: string;
  hotel_name: string;
  hotel_stars: number | null;
  hotel_zone: "A" | "B" | "C" | "";
  distance_to_haram_m: number | null;
  meals_included: "full" | "half" | "self" | "";
  transport_type: "private" | "shared" | "self" | "";
  visa_included: boolean;
  flights_included: boolean;
  base_price: string;
  currency: string;
}

const zoneColor: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  B: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  C: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function PackagePreviewCard({
  draft,
  primaryImageUrl,
}: {
  draft: PackageDraft;
  primaryImageUrl?: string | null;
}) {
  const title = draft.title || "Your package title";
  const dateRange =
    draft.date_start && draft.date_end
      ? `${new Date(draft.date_start).toLocaleDateString()} – ${new Date(draft.date_end).toLocaleDateString()}`
      : "Select dates";

  return (
    <Card className="overflow-hidden border-border">
      {primaryImageUrl ? (
        <img
          src={primaryImageUrl}
          alt={title}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/15 via-accent/20 to-primary/10 flex items-center justify-center text-primary/40">
          <Hotel className="h-16 w-16" />
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold leading-tight text-foreground">{title}</h3>
            {draft.type && (
              <Badge variant="secondary" className="capitalize">
                {draft.type}
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">From</div>
            <div className="text-lg font-bold text-primary">
              {draft.currency} {draft.base_price || "-"}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {draft.departure_city || "Departure city"}
              {draft.departure_country ? `, ${draft.departure_country}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{dateRange}</span>
          </div>
          {draft.hotel_name && (
            <div className="flex items-center gap-2">
              <Hotel className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {draft.hotel_name}
                {draft.hotel_stars ? ` · ${draft.hotel_stars}★` : ""}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {draft.hotel_zone && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                zoneColor[draft.hotel_zone],
              )}
            >
              Zone {draft.hotel_zone}
            </span>
          )}
          {draft.distance_to_haram_m != null && (
            <Badge variant="outline" className="text-xs">
              {draft.distance_to_haram_m}m to Haram
            </Badge>
          )}
          {draft.meals_included && (
            <Badge variant="outline" className="text-xs">
              <Utensils className="mr-1 h-3 w-3" /> {draft.meals_included}
            </Badge>
          )}
          {draft.transport_type && (
            <Badge variant="outline" className="text-xs">
              <Bus className="mr-1 h-3 w-3" /> {draft.transport_type}
            </Badge>
          )}
          {draft.visa_included && (
            <Badge variant="outline" className="text-xs">
              <BadgeCheck className="mr-1 h-3 w-3" /> Visa
            </Badge>
          )}
          {draft.flights_included && (
            <Badge variant="outline" className="text-xs">
              ✈ Flights
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
