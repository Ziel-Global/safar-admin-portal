import { supabase } from "@/integrations/supabase/client";

export type AgentAccessStatus = "pending" | "rejected" | "invited" | "completed";

export type AgentAccessRequest = {
  id: string;
  email: string;
  full_name: string;
  country_code: string | null;
  business_name: string;
  city: string | null;
  status: AgentAccessStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  invited_at: string | null;
  completed_at: string | null;
  user_id: string | null;
  created_at: string;
};

export type AccessRequestFilter = "all" | "pending" | "invited" | "approved" | "rejected";

export function filterAccessRequests(
  rows: AgentAccessRequest[],
  filter: AccessRequestFilter,
): AgentAccessRequest[] {
  switch (filter) {
    case "pending":
      return rows.filter((r) => r.status === "pending");
    case "invited":
      return rows.filter((r) => r.status === "invited");
    case "approved":
      return rows.filter((r) => r.status === "completed");
    case "rejected":
      return rows.filter((r) => r.status === "rejected");
    default:
      return rows;
  }
}

async function adminApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("You must be signed in as an admin");
  }

  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    debug?: {
      name?: string | null;
      message?: string | null;
      status?: number | null;
      code?: string | null;
      cause?: unknown;
    };
  };
  if (!res.ok) {
    const debugParts: string[] = [];
    if (payload.debug?.code) debugParts.push(`code=${payload.debug.code}`);
    if (payload.debug?.status) debugParts.push(`status=${payload.debug.status}`);
    if (payload.debug?.cause) {
      const causeText =
        typeof payload.debug.cause === "string"
          ? payload.debug.cause
          : JSON.stringify(payload.debug.cause);
      debugParts.push(`cause=${causeText}`);
    }
    const debugSuffix = debugParts.length ? ` (${debugParts.join(", ")})` : "";
    throw new Error((payload.error ?? `Request failed (${res.status})`) + debugSuffix);
  }
  return payload as T;
}

export function approveAgentAccessRequest(requestId: string) {
  return adminApi<{ success: true }>("/api/admin/agent-access/approve", { requestId });
}

export function rejectAgentAccessRequest(requestId: string, reason?: string) {
  return adminApi<{ success: true }>("/api/admin/agent-access/reject", { requestId, reason });
}

export function statusBadgeClass(status: AgentAccessStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "invited":
      return "bg-sky-100 text-sky-900 border-sky-300";
    case "completed":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "rejected":
      return "bg-rose-100 text-rose-900 border-rose-300";
  }
}

export function statusLabel(status: AgentAccessStatus): string {
  switch (status) {
    case "completed":
      return "Active";
    case "invited":
      return "Invited";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
