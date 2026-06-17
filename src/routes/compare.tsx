import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Check,
  MapPin,
  Star,
  Utensils,
  Bus,
  ShieldCheck,
  Users,
  ImageOff,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

const compareSchema = z.object({
  ids: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/compare")({
  validateSearch: zodValidator(compareSchema),
  head: () => ({
    meta: [
      { title: "Compare Packages - Safar" },
      {
        name: "description",
        content: "Compare Hajj and Umrah packages side-by-side: prices, hotels, distance to Haram, inclusions, and trust scores.",
      },
      { property: "og:title", content: "Compare Packages - Safar" },
      {
        property: "og:description",
        content: "Compare Hajj and Umrah packages side-by-side.",
      },
    ],
  }),
  component: ComparePage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-6">
          <Link to="/search">Back to search</Link>
        </Button>
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Not found</h1>
        <Button asChild className="mt-6">
          <Link to="/search">Back to search</Link>
        </Button>
      </div>
    </PublicLayout>
  ),
});

interface ComparePackage {
  id: string;
  slug: string | null;
  title: string;
  thumbnail_url: string | null;
  base_price: number | null;
  currency: string;
  hotel_name: string | null;
  hotel_stars: number | null;
  hotel_zone: string | null;
  distance_to_haram_m: number | null;
  meals_included: string | null;
  transport_type: string | null;
  visa_included: boolean;
  group_size_min: number | null;
  group_size_max: number | null;
  agents: {
    business_name: string;
    slug: string | null;
    trust_score: number;
    avg_rating: number;
  } | null;
}

const ZONE_STYLES: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-amber-100 text-amber-800 border-amber-300",
  C: "bg-rose-100 text-rose-800 border-rose-300",
};

function trustLabel(score: number) {
  if (score >= 80) return "Highly Trusted";
  if (score >= 50) return "Trusted";
  return "New";
}

function ComparePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const ids = useMemo<string[]>(
    () =>
      ((search.ids ?? "") as string)
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .slice(0, 4),
    [search.ids],
  );

  const [packages, setPackages] = useState<ComparePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (ids.length === 0) {
        setPackages([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("packages")
        .select(
          "id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_stars, hotel_zone, distance_to_haram_m, meals_included, transport_type, visa_included, group_size_min, group_size_max, agents(business_name, slug, trust_score, avg_rating)",
        )
        .in("id", ids);
      if (cancelled) return;
      if (error) {
        console.error("Compare fetch error:", error);
        setPackages([]);
      } else {
        // Preserve URL ordering
        const map = new Map((data ?? []).map((p) => [p.id, p]));
        const ordered = ids
          .map((id) => map.get(id))
          .filter(Boolean) as unknown as ComparePackage[];
        setPackages(ordered);
      }
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const removePackage = (id: string) => {
    const next = ids.filter((x: string) => x !== id);
    navigate({
      search: { ids: next.length > 0 ? next.join(",") : undefined },
    });
  };

  // Stats for highlighting
  const prices = packages
    .map((p) => p.base_price)
    .filter((v): v is number => v != null);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const distances = packages
    .map((p) => p.distance_to_haram_m)
    .filter((v): v is number => v != null);
  const minDist = distances.length ? Math.min(...distances) : null;
  const maxDist = distances.length ? Math.max(...distances) : null;

  const ratings = packages
    .map((p) => p.agents?.avg_rating ?? 0)
    .filter((v) => v > 0);
  const maxRating = ratings.length ? Math.max(...ratings) : null;

  // Distance heatmap color
  const distanceColor = (d: number | null) => {
    if (d == null || minDist == null || maxDist == null || minDist === maxDist) {
      return "";
    }
    const t = (d - minDist) / (maxDist - minDist);
    if (t < 0.34) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (t < 0.67) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  type Row = {
    key: string;
    label: string;
    value: (p: ComparePackage) => string;
    render: (p: ComparePackage) => React.ReactNode;
  };

  const rows: Row[] = [
    {
      key: "thumbnail",
      label: "Photo",
      value: (p) => p.thumbnail_url ?? "-",
      render: (p) => (
        <OptimizedImage
          src={p.thumbnail_url}
          alt={p.title}
          size="card"
          wrapperClassName="h-28 w-full rounded-md sm:h-32"
          className="h-full w-full rounded-md object-cover"
          fallback={
            <div className="flex h-28 w-full items-center justify-center rounded-md bg-secondary text-muted-foreground sm:h-32">
              <ImageOff className="h-6 w-6" />
            </div>
          }
        />
      ),
    },
    {
      key: "price",
      label: "Price",
      value: (p) => `${p.currency}:${p.base_price ?? ""}`,
      render: (p) => (
        <div
          className={cn(
            "rounded-md px-2 py-1 text-base font-bold",
            minPrice != null && p.base_price === minPrice
              ? "bg-emerald-100 text-emerald-800"
              : "text-foreground",
          )}
        >
          {formatPrice(p.base_price, p.currency)}
          <div className="text-[10px] font-normal text-muted-foreground">per person</div>
        </div>
      ),
    },
    {
      key: "hotel_name",
      label: "Hotel",
      value: (p) => p.hotel_name ?? "-",
      render: (p) => (
        <span className="text-sm font-medium text-foreground/90">
          {p.hotel_name ?? "-"}
          {p.hotel_stars ? (
            <span className="ml-1 text-xs text-amber-600">{"★".repeat(p.hotel_stars)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "hotel_zone",
      label: "Zone",
      value: (p) => p.hotel_zone ?? "-",
      render: (p) =>
        p.hotel_zone ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
              ZONE_STYLES[p.hotel_zone] ?? "bg-secondary border-border",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Zone {p.hotel_zone}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: "distance",
      label: "Distance to Haram",
      value: (p) => String(p.distance_to_haram_m ?? "-"),
      render: (p) =>
        p.distance_to_haram_m != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
              distanceColor(p.distance_to_haram_m) || "border-border bg-secondary",
            )}
          >
            <MapPin className="h-3 w-3" />
            {p.distance_to_haram_m}m
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: "rating",
      label: "Agent Rating",
      value: (p) => String(p.agents?.avg_rating ?? 0),
      render: (p) => {
        const r = p.agents?.avg_rating ?? 0;
        if (r === 0) return <span className="text-sm text-muted-foreground">No reviews</span>;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold",
              maxRating != null && r === maxRating
                ? "bg-emerald-100 text-emerald-800"
                : "text-foreground",
            )}
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {r.toFixed(1)}
          </span>
        );
      },
    },
    {
      key: "meals",
      label: "Meals",
      value: (p) => p.meals_included ?? "-",
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
          <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="capitalize">{p.meals_included?.replace(/_/g, " ") ?? "Not specified"}</span>
        </span>
      ),
    },
    {
      key: "transport",
      label: "Transport",
      value: (p) => p.transport_type ?? "-",
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
          <Bus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="capitalize">{p.transport_type?.replace(/_/g, " ") ?? "Not specified"}</span>
        </span>
      ),
    },
    {
      key: "visa",
      label: "Visa Included",
      value: (p) => (p.visa_included ? "yes" : "no"),
      render: (p) =>
        p.visa_included ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" /> Included
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-700">
            <X className="h-4 w-4" /> Not included
          </span>
        ),
    },
    {
      key: "group_size",
      label: "Group Size",
      value: (p) => `${p.group_size_min ?? "?"}-${p.group_size_max ?? "?"}`,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {p.group_size_min ?? "-"}–{p.group_size_max ?? "-"} people
        </span>
      ),
    },
    {
      key: "trust",
      label: "Agent Trust",
      value: (p) => trustLabel(p.agents?.trust_score ?? 0),
      render: (p) => {
        const label = trustLabel(p.agents?.trust_score ?? 0);
        const className =
          label === "Highly Trusted"
            ? "bg-primary/10 text-primary border-primary/30"
            : label === "Trusted"
              ? "bg-accent/15 text-accent-foreground border-accent/40"
              : "bg-secondary text-foreground/70 border-border";
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
              className,
            )}
          >
            <ShieldCheck className="h-3 w-3" /> {label}
          </span>
        );
      },
    },
  ];

  const visibleRows = diffOnly
    ? rows.filter((row) => {
        if (packages.length < 2) return true;
        const first = row.value(packages[0]);
        return packages.some((p) => row.value(p) !== first);
      })
    : rows;

  if (loading) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-64" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: ids.length || 2 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (packages.length === 0) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">No packages to compare</h1>
          <p className="mt-2 text-muted-foreground">
            Pick at least 2 packages from the search page to compare them side-by-side.
          </p>
          <Button asChild className="mt-6">
            <Link to="/search">Browse packages</Link>
          </Button>
        </div>
      </PublicLayout>
    );
  }

  const canAddMore = packages.length < 4;
  const cols = packages.length;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Comparing {packages.length} packages
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Side-by-side details to help you decide.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <Switch checked={diffOnly} onCheckedChange={setDiffOnly} />
              Show differences only
            </label>
          </div>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card snap-x snap-mandatory sm:snap-none">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `minmax(140px, 180px) repeat(${cols}, minmax(220px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="sticky left-0 z-20 border-b border-r border-border bg-muted/40 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Package
              </span>
            </div>
            {packages.map((p) => (
              <div
                key={`h-${p.id}`}
                className="snap-start border-b border-l border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-bold text-foreground">
                      {p.slug ? (
                        <Link
                          to="/packages/$slug"
                          params={{ slug: p.slug }}
                          className="hover:text-primary hover:underline"
                        >
                          {p.title}
                        </Link>
                      ) : (
                        p.title
                      )}
                    </h2>
                    {p.agents ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        by{" "}
                        {p.agents.slug ? (
                          <Link
                            to="/agents/$slug"
                            params={{ slug: p.agents.slug }}
                            className="font-medium text-foreground/80 hover:underline"
                          >
                            {p.agents.business_name}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground/80">
                            {p.agents.business_name}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePackage(p.id)}
                    className="grid h-7 w-7 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Remove from comparison"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Rows */}
            {visibleRows.map((row, idx) => (
              <FragmentRow
                key={row.key}
                label={row.label}
                cells={packages.map((p) => (
                  <div key={p.id}>{row.render(p)}</div>
                ))}
                isLast={idx === visibleRows.length - 1}
                cols={cols}
              />
            ))}

            {/* Footer CTA row */}
            <div className="sticky left-0 z-20 border-r border-border bg-muted/40 p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Action
            </div>
            {packages.map((p) => (
              <div
                key={`f-${p.id}`}
                className="snap-start border-l border-border bg-card p-4"
              >
                <Button asChild className="w-full" size="sm">
                  {p.slug ? (
                    <Link to="/packages/$slug" params={{ slug: p.slug }}>
                      Request Quote
                    </Link>
                  ) : (
                    <span>Request Quote</span>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {canAddMore ? (
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline">
              <Link to="/search">
                <Plus className="h-4 w-4" />
                Add another package
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </PublicLayout>
  );
}

function FragmentRow({
  label,
  cells,
  isLast,
  cols,
}: {
  label: string;
  cells: React.ReactNode[];
  isLast: boolean;
  cols: number;
}) {
  return (
    <>
      <div
        className={cn(
          "sticky left-0 z-20 flex items-center border-r border-border bg-muted/40 p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          !isLast && "border-b",
        )}
      >
        {label}
      </div>
      {cells.map((cell, i) => (
        <div
          key={i}
          className={cn(
            "snap-start border-l border-border bg-card p-4",
            !isLast && "border-b",
            i === cols - 1 ? "" : "",
          )}
        >
          {cell}
        </div>
      ))}
    </>
  );
}
