import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FiltersState {
  minPrice: number;
  maxPrice: number;
  dateStart: string;
  dateEnd: string;
  groupSize: number;
  zones: ("A" | "B" | "C")[];
  meals: "any" | "full" | "half" | "self";
  accessibility: boolean;
}

export const DEFAULT_FILTERS: FiltersState = {
  minPrice: 0,
  maxPrice: 10000,
  dateStart: "",
  dateEnd: "",
  groupSize: 1,
  zones: [],
  meals: "any",
  accessibility: false,
};

interface Props {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  onReset: () => void;
  /** Lower bound of the budget slider, derived from live package prices. */
  priceMin?: number;
  /** Upper bound of the budget slider, derived from live package prices. */
  priceMax?: number;
}

const ZONE_DOTS: Record<"A" | "B" | "C", string> = {
  A: "bg-emerald-500",
  B: "bg-amber-500",
  C: "bg-rose-500",
};

export function SearchFilters({
  filters,
  onChange,
  onReset,
  priceMin = 0,
  priceMax = 10000,
}: Props) {
  const update = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleZone = (zone: "A" | "B" | "C") => {
    const next = filters.zones.includes(zone)
      ? filters.zones.filter((z) => z !== zone)
      : [...filters.zones, zone];
    update("zones", next);
  };

  // Keep ~100 steps across whatever range the live data spans (min step of 1).
  const priceStep = Math.max(1, Math.round((priceMax - priceMin) / 100));
  const sliderMin = Math.min(filters.minPrice, priceMin);
  const sliderMax = Math.max(filters.maxPrice, priceMax);

  return (
    <div className="space-y-6">
      <Section title="Budget (per person)">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-foreground">
          <span>£{filters.minPrice.toLocaleString()}</span>
          <span>
            £{filters.maxPrice.toLocaleString()}
            {filters.maxPrice >= priceMax ? "+" : ""}
          </span>
        </div>
        <Slider
          value={[filters.minPrice, filters.maxPrice]}
          min={sliderMin}
          max={sliderMax}
          step={priceStep}
          onValueChange={([min, max]) =>
            onChange({ ...filters, minPrice: min, maxPrice: max })
          }
        />
      </Section>


      <Section title="Travel dates">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.dateStart}
              onChange={(e) => update("dateStart", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => update("dateEnd", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Group size">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => update("groupSize", Math.max(1, filters.groupSize - 1))}
            aria-label="Decrease group size"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="min-w-12 flex-1 text-center text-base font-semibold">
            {filters.groupSize} {filters.groupSize === 1 ? "traveller" : "travellers"}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => update("groupSize", Math.min(50, filters.groupSize + 1))}
            aria-label="Increase group size"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Section>

      <Section title="Hotel zone">
        <div className="space-y-2">
          {(["A", "B", "C"] as const).map((zone) => (
            <label
              key={zone}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 transition-colors hover:bg-secondary/50"
            >
              <Checkbox
                checked={filters.zones.includes(zone)}
                onCheckedChange={() => toggleZone(zone)}
              />
              <span className={cn("h-2.5 w-2.5 rounded-full", ZONE_DOTS[zone])} />
              <span className="text-sm font-medium">Zone {zone}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {zone === "A" ? "Closest" : zone === "B" ? "Medium" : "Farther"}
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Meals">
        <Select value={filters.meals} onValueChange={(v) => update("meals", v as FiltersState["meals"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="full">Full board</SelectItem>
            <SelectItem value="half">Half board</SelectItem>
            <SelectItem value="self">Self-catering</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <Section title="Accessibility">
        <label className="flex items-center justify-between gap-2">
          <span className="text-sm text-foreground/80">Wheelchair-friendly only</span>
          <Switch
            checked={filters.accessibility}
            onCheckedChange={(c) => update("accessibility", c)}
          />
        </label>
      </Section>

      <Button variant="outline" className="w-full" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
