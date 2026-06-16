import { supabase } from "@/integrations/supabase/client";

export interface BadgeRow {
  id: string;
  badge_type: string;
  status: string;
  expires_at: string | null;
  verified_at: string | null;
  badge_name: string;
  color_hex: string;
}

export type ExpiryBucket = "expired" | "critical" | "warning" | "ok" | "no-expiry";

export function bucketFor(expiresAt: string | null): ExpiryBucket {
  if (!expiresAt) return "no-expiry";
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days < 30) return "critical";
  if (days < 90) return "warning";
  return "ok";
}

export function bucketLabel(b: ExpiryBucket): string {
  switch (b) {
    case "expired": return "Expired";
    case "critical": return "<30 days";
    case "warning": return "30–90 days";
    case "ok": return ">90 days";
    case "no-expiry": return "No expiry";
  }
}

export function bucketClasses(b: ExpiryBucket): string {
  switch (b) {
    case "expired":
      return "bg-foreground text-background border-foreground";
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "warning":
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200";
    case "ok":
      return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "no-expiry":
      return "bg-secondary text-muted-foreground border-border";
  }
}

export async function fetchAgentBadgesWithExpiry(agentId: string): Promise<BadgeRow[]> {
  const { data, error } = await supabase
    .from("agent_badges")
    .select("id, badge_type, status, expires_at, verified_at, badge_types(name, color_hex)")
    .eq("agent_id", agentId)
    .order("expires_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const bt = (r as unknown as { badge_types: { name: string; color_hex: string } | null }).badge_types;
    return {
      id: r.id,
      badge_type: r.badge_type,
      status: r.status,
      expires_at: r.expires_at,
      verified_at: r.verified_at,
      badge_name: bt?.name ?? r.badge_type,
      color_hex: bt?.color_hex ?? "#888",
    };
  });
}
