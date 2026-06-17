import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Megaphone, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/campaigns/new")({
  head: () => ({
    meta: [
      { title: "New Campaign - Safar" },
      { name: "description", content: "Create a promotional campaign for your packages." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <CampaignNewPage />
    </ProtectedRoute>
  ),
});

type CampaignType = "holiday" | "last_minute" | "early_bird" | "custom";
type DiscountType = "percentage" | "fixed";

interface PackageOption {
  id: string;
  title: string;
  base_price: number | null;
  currency: string;
}

const CAMPAIGN_TYPES: { value: CampaignType; label: string; emoji: string }[] = [
  { value: "holiday", label: "Holiday Promo", emoji: "🎉" },
  { value: "last_minute", label: "Last-Minute Deal", emoji: "⚡" },
  { value: "early_bird", label: "Early Bird", emoji: "🐦" },
  { value: "custom", label: "Custom Campaign", emoji: "✨" },
];

function CampaignNewPage() {
  const { agent } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("custom");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [activate, setActivate] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const dateError =
    endDate < startDate
      ? "End date must be after the start date"
      : startDate < today
      ? "Start date cannot be in the past"
      : null;
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agent?.id) return;
    setLoading(true);
    supabase
      .from("packages")
      .select("id, title, base_price, currency")
      .eq("agent_id", agent.id)
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load packages");
        else setPackages((data ?? []) as PackageOption[]);
        setLoading(false);
      });
  }, [agent?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTypeChange = (v: CampaignType) => {
    setType(v);
    if (!name) {
      const t = CAMPAIGN_TYPES.find((x) => x.value === v);
      if (t && v !== "custom") setName(t.label);
    }
  };

  const handleSubmit = async () => {
    if (!agent?.id) return;
    if (!name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    const dv = parseFloat(discountValue);
    if (!Number.isFinite(dv) || dv <= 0) {
      toast.error("Discount must be greater than 0");
      return;
    }
    if (discountType === "percentage" && dv > 100) {
      toast.error("Percentage discount cannot exceed 100%");
      return;
    }
    if (selected.size === 0) {
      toast.error("Pick at least one package to include");
      return;
    }
    if (dateError) {
      toast.error(dateError);
      return;
    }

    setSubmitting(true);
    const { data: created, error: campErr } = await supabase
      .from("campaigns")
      .insert([{
        agent_id: agent.id,
        name: name.trim(),
        type,
        discount_type: discountType,
        discount_value: dv,
        start_date: startDate,
        end_date: endDate,
        status: activate ? "active" : "draft",
      }])
      .select("id")
      .single();
    if (campErr || !created) {
      toast.error("Failed to create campaign: " + (campErr?.message ?? ""));
      setSubmitting(false);
      return;
    }
    const links = Array.from(selected).map((pid) => ({
      campaign_id: created.id,
      package_id: pid,
    }));
    const { error: linkErr } = await supabase.from("campaign_packages").insert(links);
    if (linkErr) {
      toast.error("Campaign created but packages failed to link: " + linkErr.message);
      setSubmitting(false);
      return;
    }
    toast.success(activate ? "Campaign launched! 🎉" : "Campaign saved as draft");
    setSubmitting(false);
    navigate({ to: "/agent/campaigns" });
  };

  return (
    <DashboardLayout variant="agent" title="New Campaign">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Create Campaign</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Run a limited-time promotion across one or more of your packages.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/agent/campaigns">
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CAMPAIGN_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTypeChange(t.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                        type === t.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="text-xl">{t.emoji}</span>
                      <span className="font-medium text-foreground">{t.label}</span>
                      {type === t.value && (
                        <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cname">Campaign name</Label>
                  <Input
                    id="cname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Early Booking 2026"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Discount type</Label>
                    <Select
                      value={discountType}
                      onValueChange={(v) => setDiscountType(v as DiscountType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dv">
                      Discount value {discountType === "percentage" ? "(%)" : "(amount)"}
                    </Label>
                    <Input
                      id="dv"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sd">Start date</Label>
                    <Input
                      id="sd"
                      type="date"
                      min={today}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ed">End date</Label>
                    <Input
                      id="ed"
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      aria-invalid={!!dateError}
                    />
                  </div>
                </div>
                {dateError && (
                  <p className="text-sm text-destructive">{dateError}</p>
                )}
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={activate}
                    onCheckedChange={(v) => setActivate(v === true)}
                  />
                  Activate immediately (otherwise saved as draft)
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Packages to include ({selected.size} selected)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You don't have any packages yet.{" "}
                    <Link to="/agent/packages/new" className="text-primary hover:underline">
                      Create one first
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="space-y-2">
                    {packages.map((pkg) => {
                      const isSel = selected.has(pkg.id);
                      return (
                        <label
                          key={pkg.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                            isSel
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40",
                          )}
                        >
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={() => toggle(pkg.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{pkg.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {pkg.base_price != null
                                ? `${pkg.currency} ${pkg.base_price}`
                                : "No base price"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="h-4 w-4" /> Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Name</div>
                  <div className="font-semibold text-foreground">{name || "Untitled"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Discount</div>
                  <div className="font-semibold text-primary">
                    {discountType === "percentage"
                      ? `${discountValue}% off`
                      : `${discountValue} off`}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Runs</div>
                  <div className="text-foreground">
                    {startDate} → {endDate}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Packages</div>
                  <div className="text-foreground">{selected.size} selected</div>
                </div>
              </CardContent>
            </Card>
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="mr-1 h-4 w-4" />
              )}
              {activate ? "Launch Campaign" : "Save as Draft"}
            </Button>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
