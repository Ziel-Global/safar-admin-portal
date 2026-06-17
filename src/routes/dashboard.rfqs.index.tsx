import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, Inbox, Plus, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RfqCardSkeleton } from "@/components/ui/skeletons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";
import { RFQ_STATUS_LABEL, TYPE_LABEL, type RfqType } from "@/lib/rfq";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/rfqs/")({
  head: () => ({
    meta: [
      { title: "Your Requests - Safar" },
      { name: "description", content: "View and manage your submitted Hajj and Umrah quote requests." },
    ],
  }),
  component: RfqListPage,
});

interface RfqRow {
  id: string;
  type: RfqType;
  departure_city: string;
  departure_country: string;
  date_from: string | null;
  date_to: string | null;
  adults: number;
  children: number;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  status: string;
  matched_agents: number;
  expires_at: string;
  created_at: string;
  quote_count: number;
}

function RfqListPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <RfqListContent />
    </ProtectedRoute>
  );
}

function RfqListContent() {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: rfqRows } = await supabase
        .from("rfqs")
        .select(
          "id, type, departure_city, departure_country, date_from, date_to, adults, children, budget_min, budget_max, budget_currency, status, matched_agents, expires_at, created_at",
        )
        .eq("pilgrim_id", user.id)
        .order("created_at", { ascending: false });

      const ids = (rfqRows ?? []).map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: q } = await supabase.from("quotes").select("rfq_id").in("rfq_id", ids);
        counts = (q ?? []).reduce<Record<string, number>>((acc, x) => {
          acc[x.rfq_id] = (acc[x.rfq_id] ?? 0) + 1;
          return acc;
        }, {});
      }
      if (!active) return;
      setRfqs(
        ((rfqRows ?? []) as Omit<RfqRow, "quote_count">[]).map((r) => ({
          ...r,
          quote_count: counts[r.id] ?? 0,
        })),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <DashboardLayout variant="pilgrim" title="Your Requests">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Your requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All quote requests you've sent. Click any to view quotes, edit, or cancel.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/rfq/new">
              <Plus className="h-4 w-4" /> New request
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <RfqCardSkeleton />
            <RfqCardSkeleton />
          </div>
        ) : rfqs.length === 0 ? (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">You haven't submitted any requests yet.</p>
              <Button asChild className="mt-4 gap-2">
                <Link to="/rfq/new">
                  <Plus className="h-4 w-4" /> Start a request
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rfqs.map((rfq) => {
              const status =
                rfq.quote_count > 0 && rfq.status === "submitted" ? "quotes_received" : rfq.status;
              const tone = RFQ_STATUS_LABEL[status]?.tone;
              return (
                <Card key={rfq.id} className="border-border transition-shadow hover:shadow-md">
                  <Link to="/dashboard/rfqs/$id" params={{ id: rfq.id }} className="block">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("border", tone)}>
                              {RFQ_STATUS_LABEL[status]?.label ?? status}
                            </Badge>
                            <Badge variant="outline">{TYPE_LABEL[rfq.type]}</Badge>
                          </div>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {rfq.departure_city}, {rfq.departure_country}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rfq.created_at), "MMM d")}
                        </p>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">
                            {rfq.date_from ?? "Any"} → {rfq.date_to ?? "Any"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">
                            {rfq.adults}
                            {rfq.children > 0 ? ` + ${rfq.children}` : ""}
                          </span>
                        </div>
                        <div className="text-foreground">
                          {formatPrice(rfq.budget_min ?? 0, rfq.budget_currency)} -{" "}
                          {formatPrice(rfq.budget_max ?? 0, rfq.budget_currency)}
                        </div>
                        <div className="text-right text-foreground">
                          <span className="font-semibold">{rfq.quote_count}</span>{" "}
                          <span className="text-muted-foreground">
                            {rfq.quote_count === 1 ? "quote" : "quotes"}
                          </span>
                        </div>
                      </dl>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
