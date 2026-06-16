export type RfqType = "hajj" | "umrah";
export type ZonePref = "any" | "A" | "B" | "C";

export interface RfqDraft {
  type: RfqType;
  departure_city: string;
  departure_country: string;
  date_from: string | null;
  date_to: string | null;
  adults: number;
  children: number;
  children_ages: number[];
  accessibility_needs: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  zone_pref: ZonePref;
  meal_pref: string;
  transport_pref: string;
  notes: string;
}

export const DRAFT_KEY = "safar:rfq:draft";

export const emptyDraft: RfqDraft = {
  type: "umrah",
  departure_city: "",
  departure_country: "",
  date_from: null,
  date_to: null,
  adults: 1,
  children: 0,
  children_ages: [],
  accessibility_needs: "",
  budget_min: 1500,
  budget_max: 5000,
  budget_currency: "GBP",
  zone_pref: "any",
  meal_pref: "any",
  transport_pref: "any",
  notes: "",
};

export function loadDraft(): RfqDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft;
    return { ...emptyDraft, ...JSON.parse(raw) };
  } catch {
    return emptyDraft;
  }
}

export function saveDraft(draft: RfqDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export const RFQ_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-secondary text-foreground/70 border-border" },
  submitted: { label: "Submitted", tone: "bg-accent/15 text-accent-foreground border-accent/40" },
  quotes_received: { label: "Quotes Received", tone: "bg-primary/10 text-primary border-primary/30" },
  comparing: { label: "Comparing", tone: "bg-amber-100 text-amber-800 border-amber-300" },
  booked: { label: "Booked", tone: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  expired: { label: "Expired", tone: "bg-rose-100 text-rose-800 border-rose-300" },
  cancelled: { label: "Cancelled", tone: "bg-secondary text-foreground/60 border-border" },
};

export const TYPE_LABEL: Record<RfqType, string> = {
  hajj: "Hajj",
  umrah: "Umrah",
};
