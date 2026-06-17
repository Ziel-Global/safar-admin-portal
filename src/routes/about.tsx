import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  GitCompare,
  Star,
  Search,
  FileText,
  Scale,
  Plane,
  AlertTriangle,
  ImageOff,
  MessageSquareX,
  Eye,
  Award,
  Users,
  Heart,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Safar - Trusted Hajj & Umrah Marketplace" },
      {
        name: "description",
        content:
          "Safar connects pilgrims with verified, licensed travel agents for Hajj and Umrah. Compare packages, read real reviews, and book with confidence.",
      },
      { property: "og:title", content: "About Safar - Trusted Hajj & Umrah Marketplace" },
      {
        property: "og:description",
        content:
          "Bringing transparency to Hajj and Umrah travel. Verified agents, real reviews, side-by-side comparison.",
      },
    ],
  }),
  component: AboutPage,
});

const painPoints = [
  { icon: Scale, text: "No way to compare agents or packages side by side" },
  { icon: AlertTriangle, text: "Unlicensed operators with no accountability" },
  { icon: ImageOff, text: "Hotels and services that don't match what was promised" },
  { icon: MessageSquareX, text: "No verified reviews from real pilgrims who actually travelled" },
];

const solutions = [
  {
    icon: Shield,
    title: "Verified Agents Only",
    body:
      "Every agent on Safar must upload their ATOL, Maqam, Ministry, or IATA credentials. We verify every document before they can list a single package.",
  },
  {
    icon: GitCompare,
    title: "Compare With Confidence",
    body:
      "Search, filter, and compare packages side by side on price, hotel proximity, inclusions, and ratings. Submit one request and receive competing quotes from multiple agents.",
  },
  {
    icon: Star,
    title: "Reviews From Real Pilgrims",
    body:
      "Only pilgrims who completed their trip can leave reviews. Multi-dimension ratings cover hotel accuracy, transport, guide quality, communication, and value. Photos included.",
  },
];

const steps = [
  {
    icon: FileText,
    title: "Tell us what you need",
    body: "Share your travel dates, budget, group size, and preferences in under 2 minutes.",
  },
  {
    icon: Search,
    title: "Receive competing quotes",
    body: "Verified agents who match your route send you tailored quotes with full breakdowns.",
  },
  {
    icon: Scale,
    title: "Compare and choose",
    body:
      "Use side-by-side comparison, verified reviews, trust scores, and photo evidence to pick your agent.",
  },
  {
    icon: Plane,
    title: "Travel with confidence",
    body:
      "Your agent is accountable. After your trip, leave a verified review to help future pilgrims.",
  },
];

const values = [
  {
    icon: Eye,
    title: "Transparency",
    body:
      "Every price, every review, every credential is visible. No hidden fees, no fake reviews, no vague promises.",
  },
  {
    icon: Award,
    title: "Accountability",
    body:
      "Agents are rated, scored, and held to standards. Poor service has consequences. Great service gets rewarded.",
  },
  {
    icon: Users,
    title: "Accessibility",
    body:
      "Pilgrimage should not require insider connections or a big budget. We make the market work for everyone - from budget solo travellers to premium family groups.",
  },
  {
    icon: Heart,
    title: "Pilgrim First",
    body:
      "Every feature we build starts with one question: does this help a pilgrim make a better decision?",
  },
];

const stats = [
  {
    value: "2+ million",
    label: "British Muslims, with over 25,000 performing Hajj annually",
  },
  {
    value: "£1.2 billion",
    label: "Estimated UK Hajj and Umrah travel market",
  },
  {
    value: "0",
    label: "Marketplaces offering verified reviews and side-by-side comparison",
  },
];

function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-primary/15 via-primary/5 to-background"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, var(--primary) 0, transparent 40%), radial-gradient(circle at 85% 80%, var(--accent) 0, transparent 40%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            About Safar
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl animate-fade-in">
            Every pilgrim deserves a journey they can{" "}
            <span className="text-primary">trust</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-in">
            Safar is a marketplace connecting pilgrims with verified, licensed travel agents for
            Hajj and Umrah - bringing transparency to an industry that has lacked it for too long.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="border-t border-border/60 bg-background py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="animate-fade-in">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
                The challenge
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                The problem we're solving
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  Every year, millions of Muslims plan the most important journey of their lives -
                  Hajj or Umrah. Yet the process of finding a trustworthy travel agent is broken.
                </p>
                <p>
                  Pilgrims rely on word of mouth, WhatsApp groups, and guesswork. Unlicensed
                  operators run bait-and-switch schemes. Hotels shown in brochures don't match
                  reality. Prices are opaque and impossible to compare. Complaints go nowhere.
                </p>
                <p>
                  For a journey rooted in devotion, the booking experience is filled with anxiety
                  and risk.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {painPoints.map((point) => (
                <Card
                  key={point.text}
                  className="border-destructive/15 bg-card transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:shadow-md"
                >
                  <CardContent className="flex gap-4 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <point.icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium leading-relaxed text-foreground">
                      {point.text}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Solution */}
      <section className="border-t border-border/60 bg-secondary/30 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
              Our solution
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How Safar fixes this
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {solutions.map((s) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border/60 bg-background py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
              The process
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your journey on Safar
            </h2>
          </div>

          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => (
              <li key={step.title} className="relative">
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-sm font-bold tracking-widest text-accent">
                      0{idx + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
                {idx < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute right-[-14px] top-1/2 hidden h-px w-7 -translate-y-1/2 bg-border lg:block"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Our Values */}
      <section className="border-t border-border/60 bg-secondary/30 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
              Our principles
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What we believe
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2">
            {values.map((v) => (
              <div
                key={v.title}
                className="flex gap-5 rounded-2xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground">
                  <v.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Market */}
      <section className="border-t border-border/60 bg-background py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
              The market
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              The opportunity
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card p-8 text-center transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
                  {stat.value}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-base leading-relaxed text-muted-foreground">
            Safar is starting with the UK market and expanding to Pakistan, Indonesia, Nigeria,
            Turkey, and Bangladesh - the world's largest Hajj and Umrah origin countries.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, var(--accent) 0, transparent 45%), radial-gradient(circle at 80% 70%, var(--accent) 0, transparent 45%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to find your trusted path?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            Join thousands of pilgrims and verified agents on Safar.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              asChild
              size="lg"
              className="w-full bg-accent text-foreground hover:bg-accent/90 sm:w-auto"
            >
              <Link to="/search">Search Packages</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
            >
              <Link to="/signup">List Your Agency</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

