import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, Inbox, Plus, Send, Users } from "lucide-react";
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

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard - Safar" },
      {
        name: "description",
        content: "Your Hajj and Umrah quote requests, saved packages, and pilgrim profile.",
      },
      { property: "og:title", content: "Dashboard - Safar" },
      { property: "og:description", content: "Your pilgrim dashboard." },
    ],
  }),
  component: DashboardPage,
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

function DashboardPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <DashboardContent />
    </ProtectedRoute>
  );
}

interface BookingRow {
  id: string;
  trip_start: string | null;
  trip_end: string | null;
  total_amount: number | null;
  currency: string;
  status: string;
  agent_name: string | null;
  has_review: boolean;
}

function DashboardContent() {
  const { user, profile } = useAuth();
  const name = profile?.full_name?.split(" ")[0] ?? "pilgrim";
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [rfqRes, bookingRes] = await Promise.all([
        // Fields: card view needs id, type, departure_city/country, date_from/to, adults,
        //   children, budget min/max+currency, status, matched_agents, expires_at, created_at.
        //   Detail page (`/dashboard/rfqs/$id`) loads notes + accessibility_needs separately.
        supabase
          .from("rfqs")
          .select(
            "id, type, departure_city, departure_country, date_from, date_to, adults, children, budget_min, budget_max, budget_currency, status, matched_agents, expires_at, created_at",
          )
          .eq("pilgrim_id", user.id)
          .order("created_at", { ascending: false })
          .range(0, 49),
        // Fields: booking card needs id, trip dates, total_amount+currency, status, agent name,
        //   and a marker for whether a review has been submitted.
        supabase
          .from("bookings")
          .select(
            "id, trip_start, trip_end, total_amount, currency, status, agents:agent_id(business_name), reviews(id)",
          )
          .eq("pilgrim_id", user.id)
          .order("created_at", { ascending: false })
          .range(0, 49),
      ]);
      const rfqRows = rfqRes.data ?? [];

      const ids = rfqRows.map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        // Fields: only rfq_id — used to count quotes per RFQ for the card badge.
        const { data: quoteRows } = await supabase
          .from("quotes")
          .select("rfq_id")
          .in("rfq_id", ids);
        counts = (quoteRows ?? []).reduce<Record<string, number>>((acc, q) => {
          acc[q.rfq_id] = (acc[q.rfq_id] ?? 0) + 1;
          return acc;
        }, {});
      }

      if (!active) return;
      setRfqs(
        (rfqRows as Omit<RfqRow, "quote_count">[]).map((r) => ({
          ...r,
          quote_count: counts[r.id] ?? 0,
        })),
      );
      setBookings(
        ((bookingRes.data ?? []) as unknown as Array<{
          id: string;
          trip_start: string | null;
          trip_end: string | null;
          total_amount: number | null;
          currency: string;
          status: string;
          agents: { business_name: string } | null;
          reviews: { id: string }[] | null;
        }>).map((b) => ({
          id: b.id,
          trip_start: b.trip_start,
          trip_end: b.trip_end,
          total_amount: b.total_amount,
          currency: b.currency,
          status: b.status,
          agent_name: b.agents?.business_name ?? null,
          has_review: (b.reviews?.length ?? 0) > 0,
        })),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <DashboardLayout variant="pilgrim" title="Pilgrim Dashboard">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your quote requests and continue planning your journey.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/rfq/new">
              <Plus className="h-4 w-4" /> New quote request
            </Link>
          </Button>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Active requests" value={rfqs.filter((r) => r.status !== "expired" && r.status !== "cancelled").length} icon={Send} />
          <Stat label="Quotes received" value={rfqs.reduce((s, r) => s + r.quote_count, 0)} icon={Inbox} />
          <Stat label="Booked" value={rfqs.filter((r) => r.status === "booked").length} icon={Calendar} />
        </div>

        <h3 className="mb-3 text-lg font-semibold text-foreground">Your requests</h3>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <RfqCardSkeleton />
            <RfqCardSkeleton />
            <RfqCardSkeleton />
          </div>
        ) : rfqs.length === 0 ? (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                You haven't requested any quotes yet.
              </p>
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
                rfq.quote_count > 0 && rfq.status === "submitted"
                  ? "quotes_received"
                  : rfq.status;
              const tone = RFQ_STATUS_LABEL[status]?.tone;
              return (
                <Card key={rfq.id} className="border-border transition-shadow hover:shadow-md">
                  <Link
                    to="/dashboard/rfqs/$id"
                    params={{ id: rfq.id }}
                    className="block"
                  >
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

        {bookings.length > 0 ? (
          <div className="mt-10">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Your bookings</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {bookings.map((b) => {
                const tripEnded = b.trip_end ? new Date(b.trip_end) < new Date() : false;
                return (
                  <Card key={b.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-foreground">
                            {b.agent_name ?? "Booking"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {b.trip_start ?? "TBC"} → {b.trip_end ?? "TBC"}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {b.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm text-foreground">
                          {b.total_amount ? formatPrice(b.total_amount, b.currency) : "-"}
                        </p>
                        {tripEnded && !b.has_review ? (
                          <Button asChild size="sm">
                            <Link to="/review/$bookingId" params={{ bookingId: b.id }}>
                              Write a review
                            </Link>
                          </Button>
                        ) : b.has_review ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border">
                            Reviewed
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Send;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
