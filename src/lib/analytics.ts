import { supabase } from "@/integrations/supabase/client";

export type DateRangePreset = "7d" | "30d" | "90d" | "ytd" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function presetToRange(preset: DateRangePreset, custom?: DateRange): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = today;
  const from = new Date(today);
  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 6);
      break;
    case "30d":
      from.setDate(from.getDate() - 29);
      break;
    case "90d":
      from.setDate(from.getDate() - 89);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "custom":
      return custom ?? { from, to };
  }
  return { from, to };
}

export function previousRange({ from, to }: DateRange): DateRange {
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from: prevFrom, to: prevTo };
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function eachDay({ from, to }: DateRange): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export interface DailyMetric {
  date: string;
  views: number;
  enquiries: number;
  quotes_sent: number;
  bookings: number;
  revenue: number;
}

export async function fetchAgentMetrics(agentId: string, range: DateRange): Promise<DailyMetric[]> {
  const { data, error } = await supabase.rpc("agent_analytics_daily", {
    _agent_id: agentId,
    _from: toIsoDate(range.from),
    _to: toIsoDate(range.to),
  });
  if (error) throw error;
  const map = new Map<string, DailyMetric>();
  for (const r of data ?? []) {
    map.set(r.date as string, {
      date: r.date as string,
      views: r.views ?? 0,
      enquiries: r.enquiries ?? 0,
      quotes_sent: r.quotes_sent ?? 0,
      bookings: r.bookings ?? 0,
      revenue: Number(r.revenue ?? 0),
    });
  }
  return eachDay(range).map(
    (d) =>
      map.get(d) ?? {
        date: d,
        views: 0,
        enquiries: 0,
        quotes_sent: 0,
        bookings: 0,
        revenue: 0,
      },
  );
}

export interface TotalsSummary {
  views: number;
  enquiries: number;
  quotes: number;
  bookings: number;
  revenue: number;
  conversionRate: number; // quotes / enquiries * 100
}

export function totals(metrics: DailyMetric[]): TotalsSummary {
  const sum = metrics.reduce(
    (acc, m) => {
      acc.views += m.views;
      acc.enquiries += m.enquiries;
      acc.quotes += m.quotes_sent;
      acc.bookings += m.bookings;
      acc.revenue += m.revenue;
      return acc;
    },
    { views: 0, enquiries: 0, quotes: 0, bookings: 0, revenue: 0 },
  );
  const conversionRate = sum.enquiries > 0 ? (sum.quotes / sum.enquiries) * 100 : 0;
  return { ...sum, conversionRate };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export interface RevenueByPackage {
  package_id: string;
  title: string;
  revenue: number;
  bookings: number;
}

export async function fetchRevenueByPackage(
  agentId: string,
  range: DateRange,
): Promise<RevenueByPackage[]> {
  const { data, error } = await supabase.rpc("agent_revenue_by_package", {
    _agent_id: agentId,
    _from: toIsoDate(range.from),
    _to: toIsoDate(range.to),
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    package_id: row.package_id,
    title: row.title ?? "Untitled",
    revenue: Number(row.revenue ?? 0),
    bookings: row.bookings ?? 0,
  }));
}

export interface SourceCount {
  source: string;
  count: number;
}

export async function fetchLeadSources(agentId: string, range: DateRange): Promise<SourceCount[]> {
  const { data, error } = await supabase.rpc("agent_lead_sources", {
    _agent_id: agentId,
    _from: toIsoDate(range.from),
    _to: toIsoDate(range.to),
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    source: row.source ?? "unknown",
    count: row.count ?? 0,
  }));
}

export async function fetchMarketBenchmark(
  countryCode: string | null,
  range: DateRange,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("market_conversion_benchmark", {
    _country_code: (countryCode ?? null) as unknown as string,
    _from: toIsoDate(range.from),
    _to: toIsoDate(range.to),
  });
  if (error) return null;
  return data === null ? null : Number(data);
}
