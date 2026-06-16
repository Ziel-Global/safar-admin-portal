export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "awaiting_deposit",
  "confirmed",
  "completed",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote Sent",
  awaiting_deposit: "Awaiting Deposit",
  confirmed: "Confirmed",
  completed: "Completed",
  lost: "Lost",
};

// Columns shown in the Kanban board (Lost is hidden by default)
export const KANBAN_COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "quote_sent",
  "awaiting_deposit",
  "confirmed",
  "completed",
];

export interface Lead {
  id: string;
  agent_id: string;
  rfq_id: string | null;
  pilgrim_id: string | null;
  status: LeadStatus;
  pilgrim_name: string | null;
  trip_type: string | null;
  departure_date: string | null;
  group_size: number | null;
  budget_range: string | null;
  source: string;
  source_detail: Record<string, unknown> | null;
  score: number;
  tags: string[] | null;
  lost_reason: string | null;
  snoozed_until: string | null;
  first_response_at: string | null;
  created_at: string;
  updated_at: string;
}

export function ageBucket(createdAt: string): "fresh" | "warm" | "stale" {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 2) return "fresh";
  if (hours < 12) return "warm";
  return "stale";
}

export function ageLabel(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const AGE_COLORS: Record<"fresh" | "warm" | "stale", string> = {
  fresh: "bg-emerald-100 text-emerald-800 border-emerald-300",
  warm: "bg-amber-100 text-amber-800 border-amber-300",
  stale: "bg-rose-100 text-rose-800 border-rose-300",
};

export const LOST_REASONS = [
  "Price too high",
  "Chose another agent",
  "No response",
  "Dates unavailable",
  "Not serious",
  "Other",
] as const;
