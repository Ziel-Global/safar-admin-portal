import { supabase } from "@/integrations/supabase/client";

export type AdminAction =
  | "review.approve"
  | "review.reject"
  | "review.flag"
  | "fraud.update_status"
  | "enforcement.issue"
  | "enforcement.revoke"
  | "verification.approve"
  | "verification.reject"
  | "agent_access.approve"
  | "agent_access.reject";

export async function logAdminAction(
  adminId: string,
  action: AdminAction,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details as never,
  });
}

export const ENFORCEMENT_LEVELS = [
  {
    level: 1 as const,
    label: "L1 - Warning",
    description: "Private notification to the agent. No public effect.",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
  {
    level: 2 as const,
    label: "L2 - Listing demotion",
    description: "Internal note for now. Future: deprioritise in search ranking.",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
  },
  {
    level: 3 as const,
    label: "L3 - Suspension",
    description: "Sets agent.status = suspended. Hides packages from search and blocks new lead delivery.",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
  {
    level: 4 as const,
    label: "L4 - Permanent ban",
    description: "Sets agent.status = banned. Account is permanently disabled.",
    badgeClass: "bg-red-200 text-red-950 border-red-500",
  },
];

export const FRAUD_REPORT_STATUSES = ["submitted", "investigating", "resolved", "dismissed"] as const;
export type FraudReportStatus = (typeof FRAUD_REPORT_STATUSES)[number];

export const FRAUD_SEVERITY = ["low", "medium", "high", "critical"] as const;
export type FraudSeverity = (typeof FRAUD_SEVERITY)[number];

export function severityClass(severity: FraudSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red-200 text-red-950 border-red-500";
    case "high":
      return "bg-rose-100 text-rose-900 border-rose-300";
    case "medium":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "low":
      return "bg-slate-100 text-slate-800 border-slate-300";
  }
}
