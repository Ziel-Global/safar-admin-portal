import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface City {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
}

interface Props {
  /** Currently selected city name (must match a value from the cities table). */
  value: string;
  /** Called when a city is picked from the canonical list. */
  onSelect: (city: City) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A constrained city picker. Unlike a free-text input, the agent can ONLY
 * choose a city that exists in the canonical `cities` table, guaranteeing the
 * stored departure_city matches exactly what the search "By City" filter uses.
 *
 * Uses a bottom Drawer on mobile (where a Popover+Command combobox is
 * unreliable for touch) and a Popover on desktop.
 */
export function CitySelect({ value, onSelect, placeholder, className }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      let q = supabase
        .from("cities")
        .select("id, name, country_code, country_name")
        .order("population", { ascending: false, nullsFirst: false })
        .limit(20);
      if (query.trim()) q = q.ilike("name", `${query.trim()}%`);
      const { data } = await q;
      if (!cancelled) {
        setResults((data ?? []) as City[]);
        setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(debounce.current);
    };
  }, [query, open]);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn("w-full justify-between font-normal", className)}
    >
      <span className="flex items-center gap-2 truncate">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value || placeholder || "Select a city"}
        </span>
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const list = (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search city..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>No city found.</CommandEmpty>
            <CommandGroup>
              {results.map((city) => (
                <CommandItem
                  key={city.id}
                  value={city.id}
                  onSelect={() => {
                    onSelect(city);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === city.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">{city.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {city.country_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle>Select departure city</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pt-2">{list}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {list}
      </PopoverContent>
    </Popover>
  );
}
