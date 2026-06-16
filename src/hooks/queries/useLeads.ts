import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/lib/leads";
import { queryKeys } from "./keys";

async function fetchAgentLeads(agentId: string): Promise<Lead[]> {
  // Fields: Kanban + list view only — slide-over panel fetches details on demand.
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, agent_id, rfq_id, pilgrim_id, status, pilgrim_name, trip_type, departure_date, group_size, budget_range, score, created_at, first_response_at, source, snoozed_until, tags, source_detail, lost_reason, updated_at",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .range(0, 199);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

/** Agent leads — 30s staleTime per spec (agents need fresh data). */
export const agentLeadsQuery = (agentId: string) =>
  queryOptions({
    queryKey: queryKeys.leads.forAgent(agentId),
    queryFn: () => fetchAgentLeads(agentId),
    staleTime: 30 * 1000,
  });

export function useAgentLeads(agentId: string | null | undefined) {
  return useQuery({
    ...agentLeadsQuery(agentId ?? ""),
    enabled: !!agentId,
  });
}
