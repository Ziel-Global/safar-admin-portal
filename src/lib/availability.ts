import { supabase } from "@/integrations/supabase/client";

export const LOW_STOCK_THRESHOLD = 5;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the lowest non-zero remaining seats across upcoming, non-blackout
 * dates for each package. Only entries with remaining <= 5 are returned —
 * those are the ones worth surfacing as a "low stock" urgency indicator.
 */
export async function fetchLowStockForPackages(
  packageIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (packageIds.length === 0) return result;
  const today = dateKey(new Date());
  const { data, error } = await supabase
    .from("package_availability")
    .select("package_id, available_slots, booked_slots, is_blackout, date")
    .in("package_id", packageIds)
    .gte("date", today)
    .order("date", { ascending: true });
  if (error || !data) return result;
  for (const r of data as Array<{
    package_id: string;
    available_slots: number;
    booked_slots: number;
    is_blackout: boolean;
  }>) {
    if (r.is_blackout) continue;
    const left = (r.available_slots ?? 0) - (r.booked_slots ?? 0);
    if (left <= 0) continue;
    const prev = result.get(r.package_id);
    if (prev == null || left < prev) result.set(r.package_id, left);
  }
  // Filter to only packages where the minimum remaining is within the urgency threshold.
  for (const [id, left] of result) {
    if (left > LOW_STOCK_THRESHOLD) result.delete(id);
  }
  return result;
}
