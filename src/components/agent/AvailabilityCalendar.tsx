import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AvailabilityRow {
  id?: string;
  package_id: string;
  date: string; // YYYY-MM-DD
  available_slots: number;
  booked_slots: number;
  price_override: number | null;
  is_blackout: boolean;
}

interface Props {
  packageId: string;
}

function ymd(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const startWeekday = (first.getDay() + 6) % 7; // Mon=0
  const days: Date[] = [];
  for (let i = 0; i < startWeekday; i++) {
    days.push(new Date(first.getFullYear(), first.getMonth(), i - startWeekday + 1));
  }
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    days.push(new Date(first.getFullYear(), first.getMonth(), d));
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return days;
}

function dotColor(row: AvailabilityRow | undefined): string {
  if (!row) return "bg-muted text-muted-foreground"; // grey
  if (row.is_blackout) return "bg-muted text-muted-foreground line-through";
  const remaining = row.available_slots - row.booked_slots;
  if (remaining <= 0) return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
  if (remaining <= 5) return "bg-amber-500/20 text-amber-800 dark:text-amber-200";
  return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200";
}

export function AvailabilityCalendar({ packageId }: Props) {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [rows, setRows] = useState<Record<string, AvailabilityRow>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSlots, setBulkSlots] = useState("20");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkBlackout, setBulkBlackout] = useState(false);

  const grid = useMemo(() => getMonthGrid(month), [month]);

  const load = async () => {
    setLoading(true);
    const start = ymd(grid[0]);
    const end = ymd(grid[grid.length - 1]);
    const { data, error } = await supabase
      .from("package_availability")
      .select("*")
      .eq("package_id", packageId)
      .gte("date", start)
      .lte("date", end);
    if (error) toast.error(error.message);
    else {
      const map: Record<string, AvailabilityRow> = {};
      (data ?? []).forEach((r) => {
        map[r.date as string] = r as AvailabilityRow;
      });
      setRows(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (packageId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, month.getFullYear(), month.getMonth()]);

  const toggleSelect = (date: string, e: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (next.has(date)) next.delete(date);
        else next.add(date);
      } else {
        // single-select replaces selection
        next.clear();
        next.add(date);
      }
      return next;
    });
  };

  // Drag-to-select state
  const dragAnchorRef = useRef<string | null>(null);
  const draggedRef = useRef<boolean>(false);

  useEffect(() => {
    const up = () => {
      dragAnchorRef.current = null;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const handlePointerDown = (date: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragAnchorRef.current = date;
    draggedRef.current = false;
  };

  const handlePointerEnter = (date: string, e: React.PointerEvent) => {
    const anchor = dragAnchorRef.current;
    if (!anchor) return;
    // If button is no longer pressed, stop the drag
    if (e.buttons === 0) {
      dragAnchorRef.current = null;
      return;
    }
    if (date === anchor && !draggedRef.current) return;
    draggedRef.current = true;
    const [lo, hi] = anchor < date ? [anchor, date] : [date, anchor];
    const next = new Set<string>();
    grid.forEach((d) => {
      const ds = ymd(d);
      if (ds >= lo && ds <= hi) next.add(ds);
    });
    setSelected(next);
  };

  const upsertRow = async (date: string, patch: Partial<AvailabilityRow>) => {
    const existing = rows[date];
    const merged: AvailabilityRow = {
      package_id: packageId,
      date,
      available_slots: existing?.available_slots ?? 0,
      booked_slots: existing?.booked_slots ?? 0,
      price_override: existing?.price_override ?? null,
      is_blackout: existing?.is_blackout ?? false,
      ...patch,
    };
    const { data, error } = await supabase
      .from("package_availability")
      .upsert(
        {
          package_id: merged.package_id,
          date: merged.date,
          available_slots: merged.available_slots,
          booked_slots: merged.booked_slots,
          price_override: merged.price_override,
          is_blackout: merged.is_blackout,
        },
        { onConflict: "package_id,date" },
      )
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    setRows((prev) => ({ ...prev, [date]: data as AvailabilityRow }));
    return data;
  };

  const clearRow = async (date: string) => {
    const existing = rows[date];
    if (!existing?.id) return;
    const { error } = await supabase.from("package_availability").delete().eq("id", existing.id);
    if (error) toast.error(error.message);
    else {
      setRows((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      toast.success("Cleared");
    }
  };

  const applyBulk = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one date");
      return;
    }
    const slots = Number(bulkSlots) || 0;
    const price = bulkPrice ? Number(bulkPrice) : null;
    let success = 0;
    for (const date of selected) {
      const r = await upsertRow(date, {
        available_slots: slots,
        is_blackout: bulkBlackout,
        price_override: price,
      });
      if (r) success += 1;
    }
    toast.success(`Updated ${success} date${success === 1 ? "" : "s"}`);
    setBulkOpen(false);
    setSelected(new Set());
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[150px] text-center text-base font-semibold">{monthLabel}</h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : "Click, drag, or shift-click to select dates"}
          </span>
          <Button size="sm" disabled={selected.size === 0} onClick={() => setBulkOpen(true)}>
            Bulk set ({selected.size})
          </Button>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Legend color="bg-emerald-500/30" label="6+ open" />
        <Legend color="bg-amber-500/40" label="1–5 left" />
        <Legend color="bg-rose-500/30" label="Sold out" />
        <Legend color="bg-muted" label="Blackout / unset" />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && (
          <>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d) => {
                const date = ymd(d);
                const inMonth = d.getMonth() === month.getMonth();
                const row = rows[date];
                const remaining = row ? row.available_slots - row.booked_slots : 0;
                const isSelected = selected.has(date);
                return (
                  <Popover key={date}>
                    <div className="relative">
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onPointerDown={(e) => handlePointerDown(date, e)}
                          onPointerEnter={(e) => handlePointerEnter(date, e)}
                          onClick={(e) => {
                            if (draggedRef.current) {
                              // Suppress popover open + single-select after a drag
                              e.preventDefault();
                              e.stopPropagation();
                              draggedRef.current = false;
                              return;
                            }
                            toggleSelect(date, e);
                          }}
                          className={cn(
                            "flex h-16 w-full flex-col items-center justify-center rounded-md border text-xs transition focus:outline-none focus:ring-2 focus:ring-ring",
                            inMonth ? "border-border" : "border-transparent opacity-40",
                            dotColor(row),
                            isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                          )}
                        >
                          <span className="text-sm font-semibold">{d.getDate()}</span>
                          {row && !row.is_blackout && (
                            <span className="text-[10px] opacity-90">
                              {Math.max(0, remaining)}/{row.available_slots}
                            </span>
                          )}
                          {row?.is_blackout && (
                            <span className="text-[10px] uppercase">Blackout</span>
                          )}
                        </button>
                      </PopoverTrigger>
                    </div>
                    <PopoverContent className="w-72" align="start">
                      <DateEditor
                        date={date}
                        row={row}
                        onSave={async (patch) => {
                          await upsertRow(date, patch);
                          toast.success("Saved");
                        }}
                        onClear={() => clearRow(date)}
                      />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk set {selected.size} date{selected.size === 1 ? "" : "s"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Available slots</Label>
              <Input
                type="number"
                value={bulkSlots}
                onChange={(e) => setBulkSlots(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Price override (optional)</Label>
              <Input
                type="number"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="Leave blank to use base price"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="bulk-blackout" className="font-normal">Blackout these dates</Label>
              <Switch id="bulk-blackout" checked={bulkBlackout} onCheckedChange={setBulkBlackout} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={applyBulk}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", color)} /> {label}
    </span>
  );
}

function DateEditor({
  date,
  row,
  onSave,
  onClear,
}: {
  date: string;
  row?: AvailabilityRow;
  onSave: (patch: Partial<AvailabilityRow>) => Promise<void>;
  onClear: () => void;
}) {
  const [slots, setSlots] = useState(String(row?.available_slots ?? 20));
  const [price, setPrice] = useState(row?.price_override != null ? String(row.price_override) : "");
  const [blackout, setBlackout] = useState(row?.is_blackout ?? false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{new Date(date).toLocaleDateString(undefined, { dateStyle: "full" })}</p>
        {row && (
          <p className="text-xs text-muted-foreground">
            {row.booked_slots} booked of {row.available_slots} ({Math.max(0, row.available_slots - row.booked_slots)} left)
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Available slots</Label>
        <Input type="number" value={slots} onChange={(e) => setSlots(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Price override</Label>
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Use base price" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor={`bo-${date}`} className="text-xs font-normal">Blackout</Label>
        <Switch id={`bo-${date}`} checked={blackout} onCheckedChange={setBlackout} />
      </div>
      <div className="flex justify-between gap-2 pt-1">
        {row && (
          <Button size="sm" variant="ghost" onClick={onClear} className="text-destructive">
            Clear
          </Button>
        )}
        <Button
          size="sm"
          className="ml-auto"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave({
              available_slots: Number(slots) || 0,
              price_override: price ? Number(price) : null,
              is_blackout: blackout,
            });
            setSaving(false);
          }}
        >
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}
