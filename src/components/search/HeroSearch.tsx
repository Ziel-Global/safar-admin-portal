import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "./CityAutocomplete";
import { cn } from "@/lib/utils";

type TripType = "hajj" | "umrah";

export function HeroSearch() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [type, setType] = useState<TripType>("umrah");

  const submit = () => {
    navigate({
      to: "/search",
      search: {
        city: city.trim() || undefined,
        type,
        page: 1,
      } as never,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-primary/5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {(["hajj", "umrah"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-all",
              type === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground/80 hover:bg-secondary/80",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex-1">
          <CityAutocomplete
            value={city}
            onChange={setCity}
            placeholder="Where are you travelling from?"
          />
        </div>
        <Button
          size="lg"
          onClick={submit}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Search className="h-4 w-4" />
          Search Packages
        </Button>
      </div>
    </div>
  );
}
