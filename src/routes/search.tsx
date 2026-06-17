import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CityAutocomplete } from "@/components/search/CityAutocomplete";
import {
  PackageCard,
  PackageCardSkeleton,
  type PackageCardData,
} from "@/components/search/PackageCard";
import {
  SearchFilters,
  DEFAULT_FILTERS,
  type FiltersState,
} from "@/components/search/SearchFilters";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { fetchActiveCampaignsForPackages } from "@/lib/campaigns";
import { fetchLowStockForPackages } from "@/lib/availability";
import { fetchSponsoredPackagesForCountry } from "@/lib/featured";

const PAGE_SIZE = 20;

const searchSchema = z.object({
  city: fallback(z.string().optional(), undefined),
  type: fallback(z.enum(["hajj", "umrah", "any"]), "any").default("any"),
  sort: fallback(
    z.enum(["best", "price_asc", "price_desc", "rating", "newest"]),
    "best",
  ).default("best"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Find Packages - Safar" },
      {
        name: "description",
        content:
          "Search and compare verified Hajj and Umrah packages from licensed travel agents.",
      },
      { property: "og:title", content: "Find Packages - Safar" },
      { property: "og:description", content: "Search verified Hajj and Umrah packages." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [packages, setPackages] = useState<PackageCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [cityInput, setCityInput] = useState(search.city ?? "");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number }>({
    min: 0,
    max: 10000,
  });
  const lastLoggedKey = useRef<string>("");

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };
  const clearCompare = () => setCompareIds([]);

  useEffect(() => {
    setCityInput(search.city ?? "");
  }, [search.city]);

  // Derive the budget slider range from real package prices so it can actually
  // filter (prices may be small, e.g. £10–£60, or large — adapt either way).
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("packages")
        .select("base_price")
        .eq("status", "active")
        .not("base_price", "is", null);
      if (!alive || !data || data.length === 0) return;
      const prices = data
        .map((r) => Number((r as { base_price: number | null }).base_price))
        .filter((n) => Number.isFinite(n));
      if (prices.length === 0) return;
      const min = Math.floor(Math.min(...prices));
      const max = Math.ceil(Math.max(...prices));
      const bounds = { min, max: max > min ? max : min + 1 };
      setPriceBounds(bounds);
      // Snap the slider thumbs to the full range on first load only.
      setFilters((prev) =>
        prev.minPrice === DEFAULT_FILTERS.minPrice &&
        prev.maxPrice === DEFAULT_FILTERS.maxPrice
          ? { ...prev, minPrice: bounds.min, maxPrice: bounds.max }
          : prev,
      );
    })();
    return () => {
      alive = false;
    };
  }, []);


  const fetchKey = useMemo(
    () => JSON.stringify({ search, filters }),
    [search, filters],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const isLoadMore = search.page > 1 && packages.length > 0;
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const from = (search.page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fields: PackageCard needs id, slug, title, thumbnail_url, base_price, currency,
      //   hotel_name, hotel_zone, distance_to_haram_m. agent_id is needed to hydrate badges.
      //   created_at is used by sort. agents.* feeds the trust pill, rating chip and response chip.
      let query = supabase
        .from("packages")
        .select(
          "id, slug, title, thumbnail_url, base_price, currency, hotel_name, hotel_zone, distance_to_haram_m, created_at, agent_id, agents!inner(business_name, slug, trust_score, avg_rating, verification_level, avg_response_mins, total_reviews)",
          { count: "exact" },
        )
        .eq("status", "active");

      if (search.type !== "any") query = query.eq("type", search.type);
      if (search.city) query = query.ilike("departure_city", `%${search.city}%`);
      if (filters.minPrice > priceBounds.min)
        query = query.gte("base_price", filters.minPrice);
      if (filters.maxPrice < priceBounds.max)
        query = query.lte("base_price", filters.maxPrice);
      // Range overlap: the package trip must intersect the user's chosen window.
      if (filters.dateStart) query = query.gte("date_end", filters.dateStart);
      if (filters.dateEnd) query = query.lte("date_start", filters.dateEnd);
      // Both group-size bounds are nullable (= no limit); only exclude packages
      // that explicitly cannot accommodate the requested group size.
      if (filters.groupSize > 1) {
        query = query.or(
          `group_size_max.gte.${filters.groupSize},group_size_max.is.null`,
        );
        query = query.or(
          `group_size_min.lte.${filters.groupSize},group_size_min.is.null`,
        );
      }
      if (filters.zones.length > 0) query = query.in("hotel_zone", filters.zones);
      if (filters.meals !== "any") query = query.eq("meals_included", filters.meals);
      if (filters.accessibility) query = query.eq("accessibility", true);

      switch (search.sort) {
        case "price_asc":
          query = query.order("base_price", { ascending: true, nullsFirst: false });
          break;
        case "price_desc":
          query = query.order("base_price", { ascending: false, nullsFirst: false });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "rating":
          query = query.order("avg_rating", {
            ascending: false,
            nullsFirst: false,
            referencedTable: "agents",
          });
          break;
        case "best":
        default:
          query = query.order("trust_score", {
            ascending: false,
            nullsFirst: false,
            referencedTable: "agents",
          });
          query = query.order("created_at", { ascending: false });
      }

      const { data, count, error } = await query.range(from, to);
      if (cancelled) return;

      if (error) {
        console.error("Package search error:", error);
        setPackages([]);
        setTotalCount(0);
      } else {
        const rows = (data ?? []) as unknown as PackageCardData[];
        // Hydrate verified badges in a single batched query
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

        // Inject sponsored packages at positions 1-3 (first page only).
        // Skip injection whenever ANY filter/search constraint is active so
        // sponsored cards can't bypass the user's filters and make the results
        // look unfiltered.
        const hasActiveConstraints =
          search.type !== "any" ||
          !!search.city ||
          filters.minPrice > priceBounds.min ||
          filters.maxPrice < priceBounds.max ||
          !!filters.dateStart ||
          !!filters.dateEnd ||
          filters.groupSize > 1 ||
          filters.zones.length > 0 ||
          filters.meals !== "any" ||
          filters.accessibility;
        let finalRows = rows;
        if (!isLoadMore && !hasActiveConstraints) {
          const sponsored = await fetchSponsoredPackagesForCountry(null, 3);
          const sponsoredIds = sponsored.map((s) => s.packageId).filter((id) => !rows.some((r) => r.id === id));
          if (sponsoredIds.length > 0) {
            // Fields: same shape as the main package card query above (sponsored injection).
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

        setPackages((prev) => (isLoadMore ? [...prev, ...finalRows] : finalRows));
        setTotalCount(count ?? 0);

        // Log search (debounced via key, only on first page load)
        if (!isLoadMore) {
          const key = fetchKey;
          if (lastLoggedKey.current !== key) {
            lastLoggedKey.current = key;
            void supabase.from("search_logs").insert({
              session_id: getSessionId(),
              pilgrim_id: user?.id ?? null,
              query_params: { ...search, filters },
              results_count: count ?? 0,
            });
          }
        }
      }

      setLoading(false);
      setLoadingMore(false);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, user?.id]);

  const updateSearch = (next: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...next, page: 1 }) });

  const loadMore = () =>
    navigate({ search: (prev: typeof search) => ({ ...prev, page: prev.page + 1 }) });

  const resetFilters = () =>
    setFilters({
      ...DEFAULT_FILTERS,
      minPrice: priceBounds.min,
      maxPrice: priceBounds.max,
    });

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (search.type !== "any")
    activeChips.push({
      label: `Type: ${search.type}`,
      onRemove: () => updateSearch({ type: "any" }),
    });
  if (search.city)
    activeChips.push({
      label: `From: ${search.city}`,
      onRemove: () => {
        setCityInput("");
        updateSearch({ city: undefined });
      },
    });
  if (filters.zones.length > 0)
    activeChips.push({
      label: `Zone ${filters.zones.join(", ")}`,
      onRemove: () => setFilters({ ...filters, zones: [] }),
    });
  if (filters.meals !== "any")
    activeChips.push({
      label: `Meals: ${filters.meals}`,
      onRemove: () => setFilters({ ...filters, meals: "any" }),
    });
  if (filters.accessibility)
    activeChips.push({
      label: "Accessible",
      onRemove: () => setFilters({ ...filters, accessibility: false }),
    });
  if (filters.minPrice > priceBounds.min || filters.maxPrice < priceBounds.max)
    activeChips.push({
      label: `£${filters.minPrice}–£${filters.maxPrice}`,
      onRemove: () =>
        setFilters({
          ...filters,
          minPrice: priceBounds.min,
          maxPrice: priceBounds.max,
        }),
    });

  const canLoadMore = !loading && packages.length < totalCount;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top search row */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <CityAutocomplete
              value={cityInput}
              onChange={setCityInput}
              onSelect={(c) => updateSearch({ city: c.name })}
              placeholder="Where are you travelling from?"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["any", "hajj", "umrah"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateSearch({ type: t })}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors",
                  search.type === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground/80 hover:border-primary/40",
                )}
              >
                {t === "any" ? "All" : t}
              </button>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                if (cityInput.trim()) updateSearch({ city: cityInput.trim() });
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Result bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              {loading
                ? "Searching…"
                : `${totalCount} ${totalCount === 1 ? "package" : "packages"}`}
            </h1>
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
                <SheetHeader className="mb-4">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <SearchFilters
                  filters={filters}
                  onChange={setFilters}
                  onReset={resetFilters}
                  priceMin={priceBounds.min}
                  priceMax={priceBounds.max}
                />
                <div className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-background px-6 py-3">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    Show {totalCount} results
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select
              value={search.sort}
              onValueChange={(v) =>
                updateSearch({ sort: v as typeof search.sort })
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best Match</SelectItem>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active chips */}
        {activeChips.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <SearchFilters
                filters={filters}
                onChange={setFilters}
                onReset={resetFilters}
                priceMin={priceBounds.min}
                priceMax={priceBounds.max}
              />
            </div>
          </aside>

          {/* Results grid */}
          <section>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PackageCardSkeleton key={i} />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <h2 className="text-lg font-semibold text-foreground">No packages found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try adjusting your filters or removing the city restriction.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    resetFilters();
                    navigate({ search: { type: "any", page: 1 } as never });
                  }}
                >
                  Clear all
                </Button>
                <div className="mt-6 text-xs text-muted-foreground">
                  Are you a travel agent?{" "}
                  <Link to="/agent/packages/new" className="font-semibold text-primary hover:underline">
                    List your first package
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {packages.map((pkg, idx) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      selected={compareIds.includes(pkg.id)}
                      onToggleSelect={toggleCompare}
                      selectDisabled={compareIds.length >= 4}
                      // First 6 cards are above the fold on desktop — load eagerly for better LCP.
                      eager={idx < 6}
                    />
                  ))}
                  {loadingMore
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <PackageCardSkeleton key={`s-${i}`} />
                      ))
                    : null}
                </div>
                {canLoadMore ? (
                  <div className="mt-8 flex justify-center">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more packages"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Floating compare bar */}
      {compareIds.length >= 2 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-content-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {compareIds.length}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Compare {compareIds.length} {compareIds.length === 1 ? "package" : "packages"}
                </p>
                <p className="text-xs text-muted-foreground">Up to 4 packages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearCompare}>
                Clear
              </Button>
              <Button asChild size="sm">
                <Link
                  to="/compare"
                  search={{ ids: compareIds.join(",") }}
                >
                  Compare Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PublicLayout>
  );
}
