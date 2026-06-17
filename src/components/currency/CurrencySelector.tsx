import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

interface Props {
  align?: "start" | "end" | "center";
  /** When true, only show the flag + code (compact for header). */
  compact?: boolean;
}

export function CurrencySelector({ align = "end", compact = true }: Props) {
  const { currency, setCurrency, currencies } = useCurrency();
  const active = currencies.find((c) => c.code === currency);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2 font-medium text-foreground/80 hover:text-foreground"
          aria-label={`Currency: ${active?.name ?? currency}`}
        >
          <span className="text-base leading-none">{active?.flag_emoji ?? "💱"}</span>
          <span className="text-sm">{currency}</span>
          {!compact ? (
            <span className="text-xs text-muted-foreground">{active?.name}</span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Display currency
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currencies.map((c) => {
          const selected = c.code === currency;
          return (
            <DropdownMenuItem
              key={c.code}
              onSelect={() => setCurrency(c.code)}
              className="flex items-center gap-2"
            >
              <span className="text-base leading-none">{c.flag_emoji ?? "💱"}</span>
              <span className="font-mono text-xs font-semibold">{c.code}</span>
              <span className="ml-1 truncate text-xs text-muted-foreground">{c.name}</span>
              <Check
                className={cn("ml-auto h-4 w-4", selected ? "opacity-100" : "opacity-0")}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
