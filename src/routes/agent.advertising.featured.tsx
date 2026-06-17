import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, MousePointerClick, Send, PoundSterling, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { tierMeets, type SubscriptionTier } from "@/lib/subscriptions";
import { FeatureLock } from "@/components/billing/FeatureLock";
import {
  estimateDailyImpressions,
  fetchAgentFeaturedCampaigns,
  fetchFeaturedMetrics,
  TARGET_MARKETS,
  type FeaturedCampaign,
} from "@/lib/featured";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/advertising/featured")({
  head: () => ({
    meta: [
      { title: "Featured Listings - Safar" },
      { name: "description", content: "Promote your packages with sponsored placements in search results." },
    ],
  }),
  component: AdvertisingPage,
});

function AdvertisingPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <AdvertisingContent />
    </ProtectedRoute>
  );
}

interface PackageOption {
  id: string;
  title: string;
}

function AdvertisingContent() {
  const { agent } = useAuth();
  const tier = (agent?.subscription_tier ?? "free") as SubscriptionTier;
  const allowed = tierMeets(tier, "professional");

  if (!agent?.id) {
    return (
      <DashboardLayout variant="agent" title="Featured Listings">
        <div className="mx-auto w-full max-w-3xl text-sm text-muted-foreground">
          Loading agent…
        </div>
      </DashboardLayout>
    );
  }

  if (!allowed) {
    return (
      <DashboardLayout variant="agent" title="Featured Listings">
        <div className="mx-auto w-full max-w-3xl">
          <FeatureLock requiredTier="professional" featureName="Featured Listings">
            <div className="p-8">
              <h3 className="text-lg font-semibold text-foreground">Boost your reach</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sponsored packages appear at the top of relevant search results in
                the markets you choose.
              </p>
            </div>
          </FeatureLock>
        </div>
      </DashboardLayout>
    );
  }

  return <AdvertisingDashboard agentId={agent.id} />;
}

function AdvertisingDashboard({ agentId }: { agentId: string }) {
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [campaigns, setCampaigns] = useState<FeaturedCampaign[]>([]);
  const [metrics, setMetrics] = useState<
    Map<string, { impressions: number; clicks: number; rfqs: number; cost: number }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [pkgRes, list] = await Promise.all([
        supabase
          .from("packages")
          .select("id, title")
          .eq("agent_id", agentId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        fetchAgentFeaturedCampaigns(agentId),
      ]);
      setPackages((pkgRes.data ?? []) as PackageOption[]);
      setCampaigns(list);
      const m = await fetchFeaturedMetrics(list.map((c) => c.id));
      setMetrics(m);
      setLoading(false);
    })();
  }, [agentId]);

  const reload = async () => {
    const list = await fetchAgentFeaturedCampaigns(agentId);
    setCampaigns(list);
    const m = await fetchFeaturedMetrics(list.map((c) => c.id));
    setMetrics(m);
  };

  return (
    <DashboardLayout variant="agent" title="Featured Listings">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/agent/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> {showForm ? "Cancel" : "New campaign"}
          </Button>
        </div>

        {showForm ? (
          <NewCampaignForm
            agentId={agentId}
            packages={packages}
            onCreated={async () => {
              setShowForm(false);
              await reload();
            }}
          />
        ) : null}

        <section>
          <h3 className="mb-3 text-lg font-semibold text-foreground">Active campaigns</h3>
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-sm font-semibold text-foreground">No campaigns yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a featured campaign to appear at the top of search results.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((c) => {
                const m = metrics.get(c.id) ?? { impressions: 0, clicks: 0, rfqs: 0, cost: 0 };
                const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
                const pkg = packages.find((p) => p.id === c.package_id);
                return (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {c.name ?? pkg?.title ?? "Campaign"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.start_date} → {c.end_date}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          c.status === "active"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-foreground/70",
                        )}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(c.target_markets ?? []).slice(0, 6).map((cc) => (
                        <span
                          key={cc}
                          className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/70"
                        >
                          {TARGET_MARKETS.find((t) => t.code === cc)?.name ?? cc}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric icon={Eye} label="Impressions" value={m.impressions} />
                      <Metric icon={MousePointerClick} label="Clicks" value={m.clicks} />
                      <Metric icon={Send} label="Enquiries" value={m.rfqs} />
                      <Metric
                        icon={PoundSterling}
                        label="Cost"
                        value={`£${m.cost.toFixed(2)}`}
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      CTR: <span className="font-semibold text-foreground/80">{ctr.toFixed(2)}%</span>
                      {" · "}Bid: £{Number(c.bid_amount).toFixed(2)} · Budget: £
                      {Number(c.budget).toFixed(0)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function NewCampaignForm({
  agentId,
  packages,
  onCreated,
}: {
  agentId: string;
  packages: PackageOption[];
  onCreated: () => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "");
  const [markets, setMarkets] = useState<string[]>(["GB"]);
  const [budget, setBudget] = useState<number>(100);
  const [bid, setBid] = useState<number>(0.5);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(in14);
  const [submitting, setSubmitting] = useState(false);

  const estDaily = useMemo(
    () => estimateDailyImpressions(budget, bid, markets.length),
    [budget, bid, markets.length],
  );
  const days = Math.max(
    1,
    Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400_000) + 1,
  );

  const toggleMarket = (code: string) =>
    setMarkets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const submit = async () => {
    if (!packageId) {
      toast.error("Select a package to promote");
      return;
    }
    if (markets.length === 0) {
      toast.error("Choose at least one target market");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("featured_campaigns").insert({
      agent_id: agentId,
      package_id: packageId,
      target_markets: markets,
      budget,
      bid_amount: bid,
      start_date: startDate,
      end_date: endDate,
      status: "active",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Featured campaign created");
    await onCreated();
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">New featured campaign</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label>Package to promote</Label>
          <Select value={packageId} onValueChange={setPackageId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Choose a package" />
            </SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {packages.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              You have no active packages - publish one first.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Daily budget (£)</Label>
            <Input
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Bid per click (£)</Label>
            <Input
              type="number"
              step="0.05"
              min={0.05}
              value={bid}
              onChange={(e) => setBid(Number(e.target.value))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Label>Target markets</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TARGET_MARKETS.map((m) => {
            const active = markets.includes(m.code);
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => toggleMarket(m.code)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground/70 hover:border-primary/40",
                )}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-semibold text-foreground">Estimated reach</p>
        <p className="mt-1 text-muted-foreground">
          Approx. <span className="font-semibold text-foreground">{estDaily.toLocaleString()}</span>{" "}
          impressions/day across {markets.length || 0} market(s) for {days} day(s).
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Creating…" : "Launch campaign"}
        </Button>
      </div>
    </div>
  );
}
