import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RfqType } from "@/lib/rfq";
import { queryKeys } from "./keys";

export interface MyRfqRow {
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

export interface MyBookingRow {
  id: string;
  trip_start: string | null;
  trip_end: string | null;
  total_amount: number | null;
  currency: string;
  status: string;
  agent_name: string | null;
  has_review: boolean;
}

export interface MyDashboardData {
  rfqs: MyRfqRow[];
  bookings: MyBookingRow[];
}

async function fetchMyDashboard(pilgrimId: string): Promise<MyDashboardData> {
  const [rfqRes, bookingRes] = await Promise.all([
    // Fields: card view only — see route header for column rationale.
    supabase
      .from("rfqs")
      .select(
        "id, type, departure_city, departure_country, date_from, date_to, adults, children, budget_min, budget_max, budget_currency, status, matched_agents, expires_at, created_at",
      )
      .eq("pilgrim_id", pilgrimId)
      .order("created_at", { ascending: false })
      .range(0, 49),
    // Fields: booking card needs id, trip dates, totals, status, agent name, review marker.
    supabase
      .from("bookings")
      .select(
        "id, trip_start, trip_end, total_amount, currency, status, agents:agent_id(business_name), reviews(id)",
      )
      .eq("pilgrim_id", pilgrimId)
      .order("created_at", { ascending: false })
      .range(0, 49),
  ]);

  const rfqRows = rfqRes.data ?? [];
  const ids = rfqRows.map((r) => r.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    // Fields: only rfq_id — counted per RFQ for the card badge.
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("rfq_id")
      .in("rfq_id", ids);
    counts = (quoteRows ?? []).reduce<Record<string, number>>((acc, q) => {
      acc[q.rfq_id] = (acc[q.rfq_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const rfqs: MyRfqRow[] = (rfqRows as Omit<MyRfqRow, "quote_count">[]).map((r) => ({
    ...r,
    quote_count: counts[r.id] ?? 0,
  }));

  const bookings: MyBookingRow[] = (
    (bookingRes.data ?? []) as unknown as Array<{
      id: string;
      trip_start: string | null;
      trip_end: string | null;
      total_amount: number | null;
      currency: string;
      status: string;
      agents: { business_name: string } | null;
      reviews: { id: string }[] | null;
    }>
  ).map((b) => ({
    id: b.id,
    trip_start: b.trip_start,
    trip_end: b.trip_end,
    total_amount: b.total_amount,
    currency: b.currency,
    status: b.status,
    agent_name: b.agents?.business_name ?? null,
    has_review: (b.reviews?.length ?? 0) > 0,
  }));

  return { rfqs, bookings };
}

/** Pilgrim dashboard — 1-minute staleTime per spec (checked frequently). */
export const myRfqsQuery = (pilgrimId: string) =>
  queryOptions({
    queryKey: queryKeys.rfqs.mine(pilgrimId),
    queryFn: () => fetchMyDashboard(pilgrimId),
    staleTime: 60 * 1000,
  });

export function useMyRfqs(pilgrimId: string | null | undefined) {
  return useQuery({
    ...myRfqsQuery(pilgrimId ?? ""),
    enabled: !!pilgrimId,
  });
}
