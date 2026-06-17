import { useEffect, useState } from "react";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AvailabilityRow {
  date: string;
  available_slots: number;
  booked_slots: number;
  price_override: number | null;
  is_blackout: boolean;
}

interface Props {
  packageId: string;
  currency: string;
  basePrice: number | null;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AvailabilityDatePicker({ packageId, currency, basePrice }: Props) {
  const [rows, setRows] = useState<Record<string, AvailabilityRow>>({});
  const [selected, setSelected] = useState<Date | undefined>();

  useEffect(() => {
    (async () => {
      const today = dateKey(new Date());
      const { data } = await supabase
        .from("package_availability")
        .select("date, available_slots, booked_slots, price_override, is_blackout")
        .eq("package_id", packageId)
        .gte("date", today)
        .order("date", { ascending: true });
      const map: Record<string, AvailabilityRow> = {};
      (data ?? []).forEach((r) => (map[r.date] = r as AvailabilityRow));
      setRows(map);
    })();
  }, [packageId]);

  const selectedKey = selected ? dateKey(selected) : undefined;
  const selectedRow = selectedKey ? rows[selectedKey] : undefined;
  const remaining = selectedRow ? selectedRow.available_slots - selectedRow.booked_slots : null;
  const dateLabel = selected
    ? selected.toLocaleDateString(undefined, { dateStyle: "long" })
    : null;

  const isUnavailable = (date: Date) => {
    const key = dateKey(date);
    const r = rows[key];
    if (!r) return false; // unset dates: leave to agent quote
    if (r.is_blackout) return true;
    if (r.available_slots - r.booked_slots <= 0) return true;
    return false;
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateLabel ?? "Pick a departure date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            disabled={(d) => d < new Date(new Date().toDateString()) || isUnavailable(d)}
            className={cn("p-3 pointer-events-auto")}
            modifiers={{
              low: (d) => {
                const r = rows[dateKey(d)];
                if (!r || r.is_blackout) return false;
                const left = r.available_slots - r.booked_slots;
                return left > 0 && left <= 5;
              },
            }}
            modifiersClassNames={{
              low: "bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold",
            }}
          />
        </PopoverContent>
      </Popover>

      {selectedRow && remaining !== null && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
            remaining <= 0
              ? "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
              : remaining <= 5
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {remaining <= 0
              ? "Sold out for this date"
              : remaining <= 5
                ? `Only ${remaining} spot${remaining === 1 ? "" : "s"} left`
                : `${remaining} spots available`}
            {selectedRow.price_override != null && (
              <> · Special price {currency} {selectedRow.price_override}</>
            )}
            {selectedRow.price_override == null && basePrice != null && (
              <> · {currency} {basePrice} pp</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
