import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSubscriptionPlans,
  type SubscriptionPlan,
  type SubscriptionTier,
} from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & Plans - Safar" },
      {
        name: "description",
        content:
          "Compare Safar subscription plans for travel agents. Find the plan that fits your agency and start connecting with pilgrims.",
      },
      { property: "og:title", content: "Pricing & Plans - Safar" },
      {
        property: "og:description",
        content: "Compare Safar subscription plans for travel agents.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { profile } = useAuth();
  const isAgent = profile?.role === "agent" || profile?.role === "admin";
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSubscriptionPlans().then((p) => {
      setPlans(p);
      setLoading(false);
    });
  }, []);

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Plans for every agency
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Choose the plan that fits your agency and start connecting with pilgrims
            searching for trusted Hajj and Umrah packages.
          </p>
        </header>

        {loading ? (
          <div className="mt-12 rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading plans…
          </div>
        ) : (
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => {
              const featured = plan.tier === "professional";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm",
                    featured ? "border-primary ring-2 ring-primary/20" : "border-border",
                  )}
                >
                  {featured ? (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      <Sparkles className="mr-1 h-3 w-3" /> Most popular
                    </Badge>
                  ) : null}
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    {plan.is_custom ? (
                      <span className="text-2xl font-bold text-foreground">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foreground">
                          £{plan.price_monthly.toFixed(0)}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    )}
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2 text-foreground/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 min-w-0">
                    {plan.is_custom ? (
                      <Button asChild variant="outline" className="w-full">
                        <a href="mailto:sales@safar.example">Contact sales</a>
                      </Button>
                    ) : isAgent ? (
                      <Button asChild variant={featured ? "default" : "outline"} className="w-full">
                        <Link to="/agent/billing">Manage plan</Link>
                      </Button>
                    ) : (
                      <Button asChild variant={featured ? "default" : "outline"} className="w-full">
                        <Link to="/signup">Get started</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="mt-12 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Feature comparison</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className="py-2 pr-4 font-semibold text-foreground">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground/80">{row.label}</td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-2 pr-4">
                        {row.values[p.tier] ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

const COMPARISON_ROWS: { label: string; values: Record<SubscriptionTier, boolean> }[] = [
  { label: "Public agency listing", values: { free: true, standard: true, professional: true, premium: true, enterprise: true } },
  { label: "Unlimited leads", values: { free: false, standard: true, professional: true, premium: true, enterprise: true } },
  { label: "Performance analytics", values: { free: false, standard: true, professional: true, premium: true, enterprise: true } },
  { label: "Media gallery & templates", values: { free: false, standard: true, professional: true, premium: true, enterprise: true } },
  { label: "Promotional campaigns", values: { free: false, standard: false, professional: true, premium: true, enterprise: true } },
  { label: "Featured listings", values: { free: false, standard: false, professional: true, premium: true, enterprise: true } },
  { label: "Priority lead delivery", values: { free: false, standard: false, professional: true, premium: true, enterprise: true } },
  { label: "Competitor benchmarks", values: { free: false, standard: false, professional: false, premium: true, enterprise: true } },
  { label: "Homepage spotlight", values: { free: false, standard: false, professional: false, premium: true, enterprise: true } },
  { label: "Multi-location & API", values: { free: false, standard: false, professional: false, premium: false, enterprise: true } },
];
