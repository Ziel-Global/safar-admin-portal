import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Megaphone, Loader2, Trash2, Power } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns - Safar" },
      { name: "description", content: "Manage your promotional campaigns." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <CampaignsIndexPage />
    </ProtectedRoute>
  ),
});

interface CampaignRow {
  id: string;
  name: string;
  type: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  start_date: string;
  end_date: string;
  status: string;
  package_count: number;
}

function CampaignsIndexPage() {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!agent?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, type, discount_type, discount_value, start_date, end_date, status")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load campaigns");
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((c) => c.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: links } = await supabase
        .from("campaign_packages")
        .select("campaign_id")
        .in("campaign_id", ids);
      for (const l of links ?? []) {
        counts.set(l.campaign_id, (counts.get(l.campaign_id) ?? 0) + 1);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    setCampaigns(
      (data ?? []).map((c) => ({
        ...c,
        // Reflect auto-expiry: an active campaign past its end date is ended
        status: c.status === "active" && c.end_date < today ? "ended" : c.status,
        package_count: counts.get(c.id) ?? 0,
      })) as CampaignRow[],
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  const toggleStatus = async (c: CampaignRow) => {
    const next = c.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("campaigns").update({ status: next }).eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next === "active" ? "Campaign activated" : "Campaign paused");
    void load();
  };

  const remove = async (c: CampaignRow) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    await supabase.from("campaign_packages").delete().eq("campaign_id", c.id);
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campaign deleted");
    void load();
  };

  return (
    <DashboardLayout variant="agent" title="Campaigns">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Your campaigns</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Promotional discounts you've created across your packages.
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/agent/campaigns/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New campaign
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">No campaigns yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first promotional campaign to attract pilgrims.
              </p>
              <Button className="mt-4" asChild>
                <Link to="/agent/campaigns/new">
                  <Plus className="mr-1 h-4 w-4" /> Create campaign
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">{c.name}</h3>
                      <Badge
                        className={cn(
                          c.status === "active"
                            ? "bg-primary/10 text-primary"
                            : c.status === "draft"
                              ? "bg-secondary text-foreground/70"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}% off`
                        : `${c.discount_value} off`}{" "}
                      · {c.start_date} → {c.end_date} · {c.package_count} package
                      {c.package_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(c)}>
                      <Power className="mr-1 h-3.5 w-3.5" />
                      {c.status === "active" ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(c)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
