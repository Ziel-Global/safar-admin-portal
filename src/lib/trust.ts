export interface TrustFactors {
  reviews: number;
  response: number;
  years: number;
  verification: number;
  complaints: number;
}

export interface TrustScoreRow {
  agent_id: string;
  total_score: number;
  factors: TrustFactors;
  tips: string[];
  computed_at: string;
}

export const FACTOR_LABELS: Record<keyof TrustFactors, string> = {
  reviews: "Customer reviews",
  response: "Response speed",
  years: "Years active",
  verification: "Verified credentials",
  complaints: "Complaint record",
};

export function trustGaugeColor(score: number): { stroke: string; bg: string; text: string; label: string } {
  if (score >= 71)
    return {
      stroke: "stroke-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      label: "Highly Trusted",
    };
  if (score >= 41)
    return {
      stroke: "stroke-amber-500",
      bg: "bg-amber-50",
      text: "text-amber-700",
      label: "Trusted",
    };
  return {
    stroke: "stroke-rose-500",
    bg: "bg-rose-50",
    text: "text-rose-700",
    label: "New",
  };
}

export function responseTimeBadge(
  avgMins: number | null | undefined,
  totalLeads: number,
): { label: string; className: string } {
  if (totalLeads < 5) {
    return { label: "New Agent", className: "bg-secondary text-foreground/70 border-border" };
  }
  if (avgMins == null) {
    return { label: "New Agent", className: "bg-secondary text-foreground/70 border-border" };
  }
  if (avgMins < 120) {
    return {
      label: "Replies within 2 hours",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (avgMins < 720) {
    return {
      label: "Replies within 12 hours",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "Replies within 24+ hours",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  };
}
