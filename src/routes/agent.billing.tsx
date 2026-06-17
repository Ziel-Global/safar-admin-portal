import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSubscriptionPlans,
  setAgentTier,
  TIER_LABEL,
  TIER_RANK,
  type SubscriptionPlan,
  type SubscriptionTier,
} from "@/lib/subscriptions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/agent/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Plans - Safar" },
      { name: "description", content: "Manage your Safar subscription and unlock advanced agent tools." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <BillingContent />
    </ProtectedRoute>
  );
}

function BillingContent() {
  const { agent, refresh } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);

  const currentTier = (agent?.subscription_tier ?? "free") as SubscriptionTier;
  const currentRank = TIER_RANK[currentTier] ?? 0;

  useEffect(() => {
    void fetchSubscriptionPlans().then((p) => {
      setPlans(p);
      setLoading(false);
    });
  }, []);

  const handleChange = async (tier: SubscriptionTier) => {
    if (!agent?.id) return;
    setPendingTier(tier);
    const { ok, error } = await setAgentTier(agent.id, tier);
    if (!ok) {
      toast.error(error ?? "Failed to update plan");
    } else {
      toast.success(`Switched to ${TIER_LABEL[tier]} plan`);
      await refresh();
    }
    setPendingTier(null);
  };

  return (
    <DashboardLayout variant="agent" title="Billing & Plans">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Choose the plan that fits your agency
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're currently on the{" "}
              <span className="font-semibold text-foreground">{TIER_LABEL[currentTier]}</span>{" "}
              plan.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading plans…
          </div>
        ) : (
          <div className="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => {
              const isCurrent = plan.tier === currentTier;
              const isUpgrade = (TIER_RANK[plan.tier] ?? 0) > currentRank;
              const isDowngrade = (TIER_RANK[plan.tier] ?? 0) < currentRank;
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
                  <div className="mt-6 min-w-0">
                    {isCurrent ? (
                      <Button disabled variant="outline" className="h-auto min-h-9 w-full whitespace-normal py-2">
                        Current plan
                      </Button>
                    ) : plan.is_custom ? (
                      <Button asChild variant="outline" className="h-auto min-h-9 w-full whitespace-normal py-2">
                        <a href="mailto:sales@safar.example">Contact sales</a>
                      </Button>
                    ) : (
                      <Button
                        className="h-auto min-h-9 w-full whitespace-normal py-2 text-xs leading-tight sm:text-sm"
                        variant={isUpgrade ? "default" : "outline"}
                        disabled={pendingTier !== null}
                        onClick={() => handleChange(plan.tier)}
                      >
                        {pendingTier === plan.tier
                          ? "Updating…"
                          : isUpgrade
                            ? `Upgrade to ${plan.name}`
                            : isDowngrade
                              ? `Downgrade to ${plan.name}`
                              : `Switch to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Feature comparison</h3>
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
      </div>
    </DashboardLayout>
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
