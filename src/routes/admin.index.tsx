import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  Users,
  UserCircle,
  ClipboardList,
  Wallet,
  Percent,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard - Safar" },
      { name: "description", content: "Platform-wide moderation overview." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="admin">
      <AdminDashboardPage />
    </ProtectedRoute>
  ),
});

interface KpiData {
  totalGmv: number;
  activeAgents: number;
  registeredPilgrims: number;
  activeRfqs: number;
  takeRate: number;
}

function AdminDashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [funnel, setFunnel] = useState<{ date: string; rfqs: number; quotes: number; bookings: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subDays(new Date(), 30).toISOString();

      try {
        const [
          { data: bookings },
          { count: activeAgents },
          { count: pilgrims },
          { count: activeRfqs },
          { data: rfqs30 },
          { data: quotes30 },
          { data: bookings30 },
        ] = await Promise.all([
          supabase.from("bookings").select("total_amount"),
          supabase.from("agents").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "pilgrim"),
          supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("status", "submitted"),
          supabase.from("rfqs").select("created_at").gte("created_at", since),
          supabase.from("quotes").select("created_at").gte("created_at", since),
          supabase.from("bookings").select("created_at").gte("created_at", since),
        ]);

        const totalGmv = (bookings ?? []).reduce(
          (sum, b) => sum + Number(b.total_amount ?? 0),
          0,
        );

        const rfqCount = rfqs30?.length ?? 0;
        const bookingCount = bookings30?.length ?? 0;
        const takeRate = bookingCount > 0 ? 8.5 : 0; // placeholder

        // bucket by day
        const days: Record<string, { rfqs: number; quotes: number; bookings: number }> = {};
        for (let i = 29; i >= 0; i--) {
          const key = format(subDays(new Date(), i), "MMM d");
          days[key] = { rfqs: 0, quotes: 0, bookings: 0 };
        }
        const bucket = (rows: { created_at: string }[] | null, key: keyof (typeof days)[string]) => {
          (rows ?? []).forEach((r) => {
            if (!r?.created_at) return;
            const k = format(new Date(r.created_at), "MMM d");
            if (days[k]) days[k][key] += 1;
          });
        };
        bucket(rfqs30 ?? null, "rfqs");
        bucket(quotes30 ?? null, "quotes");
        bucket(bookings30 ?? null, "bookings");

        setFunnel(Object.entries(days).map(([date, v]) => ({ date, ...v })));
        setKpi({
          totalGmv,
          activeAgents: activeAgents ?? 0,
          registeredPilgrims: pilgrims ?? 0,
          activeRfqs: activeRfqs ?? 0,
          takeRate,
        });
      } catch (err) {
        console.error("Failed to load admin KPIs", err);
        // Surface an empty-but-rendered dashboard rather than an endless skeleton.
        setFunnel([]);
        setKpi({ totalGmv: 0, activeAgents: 0, registeredPilgrims: 0, activeRfqs: 0, takeRate: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AdminLayout title="Admin · Dashboard">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days · live snapshot</p>
        </div>

        {loading || !kpi ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              icon={Wallet}
              label="Total GMV"
              value={`£${Math.round(kpi.totalGmv).toLocaleString()}`}
              accent="text-emerald-600"
            />
            <KpiCard
              icon={Users}
              label="Active agents"
              value={kpi.activeAgents.toLocaleString()}
              accent="text-sky-600"
            />
            <KpiCard
              icon={UserCircle}
              label="Registered pilgrims"
              value={kpi.registeredPilgrims.toLocaleString()}
              accent="text-violet-600"
            />
            <KpiCard
              icon={ClipboardList}
              label="Active RFQs"
              value={kpi.activeRfqs.toLocaleString()}
              accent="text-amber-600"
            />
            <KpiCard
              icon={Percent}
              label="Take rate"
              value={`${kpi.takeRate}%`}
              accent="text-rose-600"
              hint="Placeholder"
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Acquisition funnel - last 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 rounded-md" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={funnel}>
                    <defs>
                      <linearGradient id="gRfq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gQuote" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gBooking" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Area type="monotone" dataKey="rfqs" stroke="hsl(var(--primary))" fill="url(#gRfq)" name="RFQs" />
                    <Area type="monotone" dataKey="quotes" stroke="#f59e0b" fill="url(#gQuote)" name="Quotes" />
                    <Area type="monotone" dataKey="bookings" stroke="#10b981" fill="url(#gBooking)" name="Bookings" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
