import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  MessageSquare,
  Percent,
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Loader2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useFormatPrice } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchAgentMetrics,
  fetchLeadSources,
  fetchMarketBenchmark,
  fetchRevenueByPackage,
  pctChange,
  presetToRange,
  previousRange,
  totals,
  type DailyMetric,
  type DateRangePreset,
  type RevenueByPackage,
  type SourceCount,
  type TotalsSummary,
} from "@/lib/analytics";

export const Route = createFileRoute("/agent/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics - Safar Agent" },
      {
        name: "description",
        content:
          "Track profile views, enquiries, conversion rate and revenue across your Hajj and Umrah packages.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <ProtectedRoute requireRole="agent">
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

const SOURCE_COLORS = [
  "var(--primary)",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function AnalyticsContent() {
  const { agent } = useAuth();
  const fmt = useFormatPrice();
  const [preset, setPreset] = useState<DateRangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<DailyMetric[]>([]);
  const [previous, setPrevious] = useState<DailyMetric[]>([]);
  const [revPackages, setRevPackages] = useState<RevenueByPackage[]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [benchmark, setBenchmark] = useState<number | null>(null);

  const range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return {
        from: new Date(customFrom),
        to: new Date(customTo),
      };
    }
    return presetToRange(preset);
  }, [preset, customFrom, customTo]);

  const prevRange = useMemo(() => previousRange(range), [range]);

  useEffect(() => {
    if (!agent?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchAgentMetrics(agent.id, range),
      fetchAgentMetrics(agent.id, prevRange),
      fetchRevenueByPackage(agent.id, range),
      fetchLeadSources(agent.id, range),
      fetchMarketBenchmark(agent.country_code ?? null, range),
    ])
      .then(([cur, prev, rev, src, bench]) => {
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prev);
        setRevPackages(rev);
        setSources(src);
        setBenchmark(bench);
      })
      .catch((err) => {
        toast.error("Couldn't load analytics", { description: err.message ?? String(err) });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, range.from.getTime(), range.to.getTime()]);

  const curTotals = useMemo(() => totals(current), [current]);
  const prevTotals = useMemo(() => totals(previous), [previous]);

  const handleDownload = () => {
    const fromStr = range.from.toISOString().slice(0, 10);
    const toStr = range.to.toISOString().slice(0, 10);

    const sections: string[] = [];

    // KPI summary
    sections.push(
      Papa.unparse({
        fields: ["metric", "value"],
        data: [
          ["Date range", `${fromStr} to ${toStr}`],
          ["Profile views", curTotals.views],
          ["Enquiries", curTotals.enquiries],
          ["Quotes sent", curTotals.quotes],
          ["Bookings", curTotals.bookings],
          ["Conversion rate (%)", curTotals.conversionRate.toFixed(1)],
          ["Revenue (GBP)", curTotals.revenue.toFixed(2)],
        ],
      }),
    );

    // Daily metrics
    sections.push(
      "Daily breakdown\n" +
        Papa.unparse(
          current.map((m) => ({
            date: m.date,
            views: m.views,
            enquiries: m.enquiries,
            quotes_sent: m.quotes_sent,
            bookings: m.bookings,
            revenue: m.revenue.toFixed(2),
          })),
          { columns: ["date", "views", "enquiries", "quotes_sent", "bookings", "revenue"] },
        ),
    );

    // Revenue by package
    if (revPackages.length > 0) {
      sections.push(
        "Top packages by revenue\n" +
          Papa.unparse(
            revPackages.map((p) => ({ package: p.title, revenue: p.revenue.toFixed(2) })),
            { columns: ["package", "revenue"] },
          ),
      );
    }

    // Lead sources
    if (sources.length > 0) {
      sections.push(
        "Lead sources\n" +
          Papa.unparse(
            sources.map((s) => ({ source: s.source, count: s.count })),
            { columns: ["source", "count"] },
          ),
      );
    }

    const csv = sections.join("\n\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${fromStr}-to-${toStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <DashboardLayout variant="agent" title="Analytics">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header + range selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Performance</h2>
            <p className="text-sm text-muted-foreground">
              {range.from.toLocaleDateString()} – {range.to.toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as DateRangePreset)}>
              <TabsList>
                {PRESETS.map((p) => (
                  <TabsTrigger key={p.key} value={p.key}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1"
              />
            </label>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Eye className="h-4 w-4" />}
            title="Profile Views"
            value={curTotals.views.toLocaleString()}
            change={pctChange(curTotals.views, prevTotals.views)}
            spark={current.map((m) => m.views)}
            loading={loading}
          />
          <KpiCard
            icon={<MessageSquare className="h-4 w-4" />}
            title="Enquiries"
            value={curTotals.enquiries.toLocaleString()}
            change={pctChange(curTotals.enquiries, prevTotals.enquiries)}
            spark={current.map((m) => m.enquiries)}
            loading={loading}
          />
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            title="Conversion Rate"
            value={`${curTotals.conversionRate.toFixed(1)}%`}
            change={pctChange(curTotals.conversionRate, prevTotals.conversionRate)}
            spark={current.map((m) =>
              m.enquiries > 0 ? (m.quotes_sent / m.enquiries) * 100 : 0,
            )}
            loading={loading}
            footer={<BenchmarkNote benchmark={benchmark} value={curTotals.conversionRate} />}
          />
          <KpiCard
            icon={<PoundSterling className="h-4 w-4" />}
            title="Revenue"
            value={fmt(curTotals.revenue, "GBP")}
            change={pctChange(curTotals.revenue, prevTotals.revenue)}
            spark={current.map((m) => m.revenue)}
            loading={loading}
          />
        </div>

        {/* Enquiries line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enquiry volume</CardTitle>
            <CardDescription>Daily new leads received over the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={current}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)}
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <RTooltip
                    contentStyle={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="enquiries"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion funnel</CardTitle>
            <CardDescription>How visitors move from view to booking</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full" /> : <Funnel totals={curTotals} />}
          </CardContent>
        </Card>

        {/* Revenue + sources */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top packages by revenue</CardTitle>
              <CardDescription>Highest earning packages this period</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : revPackages.length === 0 ? (
                <EmptyChart message="No bookings in this period yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revPackages} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis
                      dataKey="title"
                      type="category"
                      width={120}
                      fontSize={11}
                      tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
                    />
                    <RTooltip
                      formatter={(v: number) => fmt(v, "GBP")}
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead sources</CardTitle>
              <CardDescription>Where your enquiries are coming from</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : sources.length === 0 ? (
                <EmptyChart message="No leads in this period yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="count"
                      nameKey="source"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {sources.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {sources.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                      />
                      <span className="capitalize text-muted-foreground">
                        {s.source.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({
  icon,
  title,
  value,
  change,
  spark,
  loading,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  change: number | null;
  spark: number[];
  loading: boolean;
  footer?: React.ReactNode;
}) {
  const data = spark.map((v, i) => ({ i, v }));
  const arrow =
    change === null ? (
      <Minus className="h-3.5 w-3.5" />
    ) : change > 0 ? (
      <TrendingUp className="h-3.5 w-3.5" />
    ) : change < 0 ? (
      <TrendingDown className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3.5 w-3.5" />
    );
  const trendClass =
    change === null || change === 0
      ? "text-muted-foreground"
      : change > 0
        ? "text-emerald-600 dark:text-emerald-500"
        : "text-rose-600 dark:text-rose-500";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {icon}
            {title}
          </div>
          <div className={cn("flex items-center gap-0.5 text-xs font-medium", trendClass)}>
            {arrow}
            {change === null ? "-" : `${Math.abs(change).toFixed(1)}%`}
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
          <div className="h-10 w-24">
            {data.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <Area
                    dataKey="v"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.18}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function Funnel({ totals }: { totals: TotalsSummary }) {
  const stages = [
    { label: "Views", value: totals.views },
    { label: "Enquiries", value: totals.enquiries },
    { label: "Quotes", value: totals.quotes },
    { label: "Bookings", value: totals.bookings },
  ];
  const max = Math.max(stages[0].value, 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const widthPct = Math.max(8, (s.value / max) * 100);
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.label}</span>
              {conv !== null && (
                <span className="font-medium text-foreground">
                  {conv.toFixed(1)}% from previous
                </span>
              )}
            </div>
            <div className="mt-1 flex h-9 items-center rounded-md bg-muted/50 p-1">
              <div
                className="flex h-full items-center justify-between rounded bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all"
                style={{ width: `${widthPct}%` }}
              >
                <span>{s.value.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BenchmarkNote({ benchmark, value }: { benchmark: number | null; value: number }) {
  // If we have no live benchmark yet, fall back to a sensible market average.
  const market = benchmark ?? 28;
  const above = value >= market;
  return (
    <p className="text-[11px] text-muted-foreground">
      Market average:{" "}
      <span className="font-medium text-foreground">{market.toFixed(1)}%</span>
      {value > 0 && (
        <span className={above ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}>
          {" "}
          - you're {above ? "above" : "below"} average
        </span>
      )}
    </p>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// Avoid "Loader2 is unused" if we tree-shake.
void Loader2;
