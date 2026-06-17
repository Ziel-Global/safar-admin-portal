import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plane } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllSeoPages, countryForCity, type SeoPage } from "@/lib/seo";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/from/")({
  head: () => ({
    meta: [
      { title: "Hajj & Umrah Packages by Departure City | Safar" },
      {
        name: "description",
        content:
          "Browse verified Hajj and Umrah packages from 30+ departure cities worldwide. Compare prices, agents and itineraries side-by-side.",
      },
      { property: "og:title", content: "Hajj & Umrah Packages by Departure City | Safar" },
      {
        property: "og:description",
        content:
          "Find Hajj and Umrah packages from your home city - London, Karachi, Jakarta, Lagos, Dubai and more.",
      },
    ],
  }),
  component: FromIndexPage,
});

type Grouped = Record<string, { city: string; entries: SeoPage[] }[]>;

function FromIndexPage() {
  const [pages, setPages] = useState<SeoPage[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAllSeoPages().then((p) => {
      if (alive) setPages(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Plane className="h-3.5 w-3.5" /> Departure cities
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Hajj & Umrah packages from your city
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Pick your departure city to see verified packages, live pricing and the trusted agents
            who run that route.
          </p>
        </div>

        <div className="mt-10">
          {pages === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No routes available yet.</p>
          ) : (
            <GroupedRoutes pages={pages} />
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function GroupedRoutes({ pages }: { pages: SeoPage[] }) {
  const grouped: Grouped = {};
  const byCity = new Map<string, SeoPage[]>();
  for (const p of pages) {
    if (!byCity.has(p.city)) byCity.set(p.city, []);
    byCity.get(p.city)!.push(p);
  }
  for (const [city, entries] of byCity) {
    const country = countryForCity(city);
    if (!grouped[country]) grouped[country] = [];
    grouped[country].push({ city, entries });
  }
  const sortedCountries = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-10">
      {sortedCountries.map((country) => {
        const cities = grouped[country].sort((a, b) => a.city.localeCompare(b.city));
        return (
          <section key={country}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">{country}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map(({ city, entries }) => (
                <Card key={city} className="border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {city}
                    </div>
                    <div className="mt-3 space-y-2">
                      {entries.map((entry) => (
                        <Link
                          key={entry.id}
                          to="/from/$city/$tripType"
                          params={{
                            city: entry.city.toLowerCase().replace(/\s+/g, "-"),
                            tripType: entry.trip_type,
                          }}
                          className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                        >
                          <div>
                            <div className="font-medium capitalize text-foreground">
                              {entry.trip_type} packages
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.agent_count} agent{entry.agent_count === 1 ? "" : "s"}
                              {entry.price_min != null
                                ? ` • from ${formatPrice(entry.price_min, "GBP")}`
                                : ""}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-primary">View →</span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
