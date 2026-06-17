import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface City {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (city: City) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || value.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("cities")
        .select("id, name, country_code, country_name")
        .ilike("name", `${value}%`)
        .order("population", { ascending: false, nullsFirst: false })
        .limit(8);
      if (!cancelled) {
        setResults((data ?? []) as City[]);
        setHighlight(0);
        setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (city: City) => {
    onChange(city.name);
    onSelect?.(city);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const city = results[highlight];
              if (city) select(city);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Where are you travelling from?"}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          {results.map((city, i) => (
            <li key={city.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(city)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  i === highlight ? "bg-secondary text-foreground" : "text-foreground/90",
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{city.name}</span>
                <span className="text-xs text-muted-foreground">{city.country_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
