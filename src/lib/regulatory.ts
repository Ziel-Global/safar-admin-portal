import { supabase } from "@/integrations/supabase/client";

export interface RegulatoryUpdate {
  id: string;
  title: string;
  body: string;
  countries: string[];
  severity: "info" | "warning" | "critical" | string;
  published_at: string | null;
  created_at: string;
}

export async function listPublishedForCountry(country: string | null | undefined): Promise<RegulatoryUpdate[]> {
  let q = supabase
    .from("regulatory_updates")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(10);
  if (country) {
    // Match either empty countries (= all) or includes country
    q = q.or(`countries.cs.{${country}},countries.eq.{}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RegulatoryUpdate[];
}

export async function listAllUpdates(): Promise<RegulatoryUpdate[]> {
  const { data, error } = await supabase
    .from("regulatory_updates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegulatoryUpdate[];
}

export function severityClasses(s: string): string {
  switch (s) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "warning":
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200";
    default:
      return "bg-secondary text-foreground border-border";
  }
}
