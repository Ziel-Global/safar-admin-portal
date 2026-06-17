import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  MapPin,
  ShieldCheck,
  Star,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSeoPage, fetchTopAgentsForRoute, fetchAllSeoPages, type SeoPage } from "@/lib/seo";
import { formatPrice, trustLabel } from "@/lib/format";

function deslugify(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/from/$city/$tripType")({
  loader: async ({ params }) => {
    const tripType = params.tripType.toLowerCase();
    if (tripType !== "hajj" && tripType !== "umrah") throw notFound();
    const cityName = deslugify(params.city);
    const page = await fetchSeoPage(cityName, tripType);
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.page) return { meta: [] };
    const p = loaderData.page;
    const meta = [
      { title: p.title },
      { name: "description", content: p.meta_description },
      { property: "og:title", content: p.title },
      { property: "og:description", content: p.meta_description },
      { property: "og:type", content: "website" },
    ];
    if (p.hero_image_url) {
      meta.push(
        { property: "og:image", content: p.hero_image_url },
        { name: "twitter:image", content: p.hero_image_url },
      );
    }
    return { meta };
  },
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Route not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We don’t have a landing page for that city and trip type yet.
        </p>
        <Button asChild className="mt-6">
          <Link to="/from">Browse all routes</Link>
        </Button>
      </div>
    </PublicLayout>
  ),
  component: FromCityTripPage,
});

type AgentCardData = {
  id: string;
  business_name: string;
  slug: string | null;
  trust_score: number;
  avg_rating: number;
  total_reviews: number;
  verification_level: string;
  logo_url: string | null;
};

function FromCityTripPage() {
  const { page } = Route.useLoaderData();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentCardData[] | null>(null);
  const [related, setRelated] = useState<SeoPage[]>([]);

  useEffect(() => {
    let alive = true;
    fetchTopAgentsForRoute(page.city, page.trip_type, 6).then((rows) => {
      if (!alive) return;
      setAgents(
        rows.map((r) => ({
          id: r.id,
          business_name: r.business_name,
          slug: r.slug,
          trust_score: r.trust_score,
          avg_rating: r.avg_rating,
          total_reviews: r.total_reviews,
          verification_level: r.verification_level,
          logo_url: r.logo_url,
        })),
      );
    });
    fetchAllSeoPages().then((all) => {
      if (!alive) return;
      setRelated(all.filter((p) => p.id !== page.id).slice(0, 8));
    });
    return () => {
      alive = false;
    };
  }, [page.id, page.city, page.trip_type]);

  const tripLabel = page.trip_type === "hajj" ? "Hajj" : "Umrah";

  const handleSearch = () => {
    router.navigate({
      to: "/search",
      search: { city: page.city, type: page.trip_type, page: 1 } as never,
    });
  };

  const faqJsonLd =
    page.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: page.faq.map((f: { question: string; answer: string }) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <PublicLayout>
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Departure: {page.city}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            {tripLabel} Packages from {page.city}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {page.meta_description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-foreground/80">
            {page.price_min != null && page.price_max != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold">
                From {formatPrice(page.price_min, "GBP")} – {formatPrice(page.price_max, "GBP")}
              </span>
            ) : null}
            {page.agent_count > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {page.agent_count} verified agent{page.agent_count === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={handleSearch} className="bg-primary hover:bg-primary/90">
              Search {tripLabel} packages from {page.city}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/rfq/new">Get tailored quotes</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top agents */}
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Top agents for {page.city} → {tripLabel}
            </h2>
            <Link
              to="/search"
              search={{ city: page.city, type: page.trip_type, page: 1 } as never}
              className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
            >
              See all packages →
            </Link>
          </div>
          <div className="mt-6">
            {agents === null ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No verified agents listed for this route yet - try a tailored quote and our
                    team will match you.
                  </p>
                  <Button asChild>
                    <Link to="/rfq/new">Request a quote</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => {
                  const trust = trustLabel(agent.trust_score, agent.verification_level);
                  return (
                    <Card key={agent.id} className="border-border transition-shadow hover:shadow-md">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-content-center overflow-hidden rounded-full bg-secondary text-foreground/70">
                            {agent.logo_url ? (
                              <OptimizedImage
                                src={agent.logo_url}
                                alt={agent.business_name}
                                size="avatar"
                                wrapperClassName="h-full w-full rounded-full"
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              <ShieldCheck className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-semibold text-foreground">
                              {agent.business_name}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${trust.className}`}
                              >
                                <ShieldCheck className="h-3 w-3" /> {trust.label}
                              </span>
                              {agent.avg_rating > 0 ? (
                                <span className="inline-flex items-center gap-1 text-foreground/70">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  <span className="font-semibold">
                                    {agent.avg_rating.toFixed(1)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ({agent.total_reviews})
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {agent.slug ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="mt-4 w-full"
                          >
                            <Link to="/agents/$slug" params={{ slug: agent.slug }}>
                              View profile
                            </Link>
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Pricing */}
        {page.price_min != null && page.price_max != null ? (
          <section className="mt-12">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pricing summary</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tripLabel} packages from {page.city} range from{" "}
                    <strong className="text-foreground">{formatPrice(page.price_min, "GBP")}</strong>{" "}
                    to{" "}
                    <strong className="text-foreground">{formatPrice(page.price_max, "GBP")}</strong>{" "}
                    per person, depending on hotel category and season.
                  </p>
                </div>
                <Button onClick={handleSearch}>Compare prices</Button>
              </CardContent>
            </Card>
          </section>
        ) : null}

        {/* FAQ */}
        {page.faq.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Frequently asked questions
              </h2>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card">
              <Accordion type="single" collapsible className="px-4">
                {page.faq.map((item: { question: string; answer: string }, idx: number) => (
                  <AccordionItem key={idx} value={`faq-${idx}`}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent className="text-foreground/80">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        ) : null}

        {/* Related */}
        {related.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Explore other routes
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to="/from/$city/$tripType"
                  params={{
                    city: r.city.toLowerCase().replace(/\s+/g, "-"),
                    tripType: r.trip_type,
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:text-primary"
                >
                  <MapPin className="h-3 w-3" />
                  <span className="capitalize">{r.trip_type}</span> from {r.city}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PublicLayout>
  );
}
