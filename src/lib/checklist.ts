import { differenceInDays } from "date-fns";

export type ChecklistItem = {
  id: string;
  section: string;
  title: string;
  description: string;
  /**
   * Days relative to the trip date when this task should be completed.
   * Negative values mean "before the trip" (e.g. -180 = 6 months before).
   */
  deadline_offset_days: number;
};

export type ChecklistSection = {
  name: string;
  items: ChecklistItem[];
};

export type Urgency = "done" | "overdue" | "soon" | "ok" | "future";

export const SECTION_ORDER = [
  "Passport & Visa",
  "Health",
  "Travel Documents",
  "Financial",
];

export function groupChecklistBySection(items: ChecklistItem[]): ChecklistSection[] {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = groups.get(item.section) ?? [];
    list.push(item);
    groups.set(item.section, list);
  }
  return SECTION_ORDER.filter((s) => groups.has(s))
    .map((name) => ({ name, items: groups.get(name) ?? [] }))
    .concat(
      Array.from(groups.entries())
        .filter(([name]) => !SECTION_ORDER.includes(name))
        .map(([name, items]) => ({ name, items })),
    );
}

export function deadlineDate(tripDate: Date | null, offsetDays: number): Date | null {
  if (!tripDate) return null;
  const d = new Date(tripDate);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export function urgencyFor(
  done: boolean,
  tripDate: Date | null,
  offsetDays: number,
): Urgency {
  if (done) return "done";
  if (!tripDate) return "future";
  const deadline = deadlineDate(tripDate, offsetDays);
  if (!deadline) return "future";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = differenceInDays(deadline, today);
  if (days < 0) return "overdue";
  if (days < 7) return "soon";
  if (days <= 30) return "ok";
  return "future";
}

export function urgencyClasses(u: Urgency): { dot: string; label: string; text: string } {
  switch (u) {
    case "done":
      return { dot: "bg-emerald-500", label: "Done", text: "text-emerald-700" };
    case "overdue":
      return { dot: "bg-red-500", label: "Overdue", text: "text-red-700" };
    case "soon":
      return { dot: "bg-amber-500", label: "Due soon", text: "text-amber-700" };
    case "ok":
      return { dot: "bg-emerald-500", label: "On track", text: "text-emerald-700" };
    case "future":
    default:
      return { dot: "bg-muted-foreground/40", label: "Plan ahead", text: "text-muted-foreground" };
  }
}

export function deadlineLabel(tripDate: Date | null, offsetDays: number): string {
  const deadline = deadlineDate(tripDate, offsetDays);
  if (!deadline) return "Set a trip date to see deadline";
  return deadline.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const COUNTRY_OPTIONS = [
  { code: "GB", name: "United Kingdom" },
  { code: "PK", name: "Pakistan" },
  { code: "ID", name: "Indonesia" },
  { code: "NG", name: "Nigeria" },
  { code: "US", name: "United States" },
  { code: "TR", name: "Turkey" },
  { code: "BD", name: "Bangladesh" },
  { code: "EG", name: "Egypt" },
  { code: "MY", name: "Malaysia" },
  { code: "IN", name: "India" },
] as const;

/** Generic fallback template for countries without a seeded template. */
export const FALLBACK_ITEMS: ChecklistItem[] = [
  { id: "passport_validity", section: "Passport & Visa", title: "Passport valid 6+ months from return", description: "Saudi Arabia requires passports valid for at least 6 months beyond your return date.", deadline_offset_days: -180 },
  { id: "visa", section: "Passport & Visa", title: "Pilgrimage visa approved", description: "Apply through a licensed operator in your country. Allow several weeks.", deadline_offset_days: -30 },
  { id: "passport_photos", section: "Passport & Visa", title: "Recent passport photos", description: "Bring 4-6 white-background passport photos for paperwork.", deadline_offset_days: -30 },
  { id: "vaccinations", section: "Health & Vaccinations", title: "Meningitis ACWY vaccine", description: "Mandatory for Saudi entry. Get at least 10 days before travel.", deadline_offset_days: -14 },
  { id: "prescriptions", section: "Health & Vaccinations", title: "Prescription medications + letter", description: "Carry medications in original packaging with a doctor letter.", deadline_offset_days: -7 },
  { id: "flight_tickets", section: "Travel Documents", title: "Return flight tickets booked", description: "Saudi authorities check return tickets on entry.", deadline_offset_days: -30 },
  { id: "hotel_voucher", section: "Travel Documents", title: "Hotel reservations confirmed", description: "Print or save Makkah and Madinah hotel vouchers.", deadline_offset_days: -14 },
  { id: "travel_insurance", section: "Travel Documents", title: "Travel insurance with medical cover", description: "Must cover pilgrimage-specific medical risks.", deadline_offset_days: -14 },
  { id: "mahram_docs", section: "Travel Documents", title: "Mahram consent letter (women under 45)", description: "Marriage or birth certificate proving Mahram relationship.", deadline_offset_days: -30 },
  { id: "currency", section: "Financial", title: "Saudi Riyal cash", description: "Carry SAR 1000-2000 cash for daily expenses.", deadline_offset_days: -7 },
  { id: "debit_card", section: "Financial", title: "International debit/credit card", description: "Notify your bank of travel dates to avoid blocks.", deadline_offset_days: -7 },
  { id: "emergency_funds", section: "Financial", title: "Emergency funds accessible", description: "Keep backup funds via a second card or wallet.", deadline_offset_days: -7 },
  { id: "ihram_packed", section: "Packing Essentials", title: "Ihram garments", description: "Two unstitched white sheets for men. Modest clothing for women.", deadline_offset_days: -7 },
  { id: "walking_shoes", section: "Packing Essentials", title: "Comfortable walking shoes", description: "You will walk many kilometres. Break them in beforehand.", deadline_offset_days: -14 },
  { id: "prayer_mat", section: "Packing Essentials", title: "Personal prayer mat", description: "A small, lightweight prayer mat is invaluable in crowded areas.", deadline_offset_days: -7 },
];
