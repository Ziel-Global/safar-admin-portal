import { Shield, Moon, Building2, Plane, type LucideIcon } from "lucide-react";

export type BadgeStatus = "pending" | "verified" | "expired" | "rejected";

export interface BadgeType {
  id: string;
  name: string;
  description: string | null;
  icon_name: string;
  color_hex: string;
  help_url: string | null;
  authority: string;
}

export interface AgentBadge {
  id: string;
  agent_id: string;
  badge_type: string;
  document_url: string | null;
  status: BadgeStatus;
  rejection_reason: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const BADGE_ICONS: Record<string, LucideIcon> = {
  Shield,
  Moon,
  Building2,
  Plane,
};

export function getBadgeIcon(name: string): LucideIcon {
  return BADGE_ICONS[name] ?? Shield;
}

export const VERIFICATION_LEVELS = ["none", "bronze", "silver", "gold", "platinum"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export function levelFromCount(count: number): VerificationLevel {
  if (count >= 4) return "platinum";
  if (count === 3) return "gold";
  if (count === 2) return "silver";
  if (count === 1) return "bronze";
  return "none";
}

export function nextLevelTarget(count: number): { next: VerificationLevel; remaining: number } {
  if (count >= 4) return { next: "platinum", remaining: 0 };
  const target = count + 1;
  return { next: levelFromCount(target), remaining: 1 };
}

export const LEVEL_STYLES: Record<VerificationLevel, string> = {
  none: "bg-secondary text-muted-foreground border-border",
  bronze: "bg-amber-100 text-amber-900 border-amber-300",
  silver: "bg-slate-100 text-slate-800 border-slate-300",
  gold: "bg-yellow-100 text-yellow-900 border-yellow-400",
  platinum: "bg-primary/10 text-primary border-primary/40",
};
