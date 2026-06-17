import { useCurrency } from "@/contexts/CurrencyContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Props {
  amount: number | null | undefined;
  currency: string;
  className?: string;
  /** When false, no tooltip is rendered (use for very small chips). */
  showOriginalTooltip?: boolean;
}

/**
 * Renders a price in the user's preferred currency.
 * On hover, shows the original amount + currency.
 */
export function PriceDisplay({
  amount,
  currency,
  className,
  showOriginalTooltip = true,
}: Props) {
  const { currency: pref, currencies, formatPrice } = useCurrency();
  const formatted = formatPrice(amount, currency);
  const sameCurrency = pref === currency || amount == null;

  if (sameCurrency || !showOriginalTooltip) {
    return <span className={className}>{formatted}</span>;
  }

  const origMeta = currencies.find((c) => c.code === currency);
  const original = formatCurrency(amount, currency, origMeta?.decimals);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help underline-offset-4 decoration-dotted", className)}>
            {formatted}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Originally listed at {original}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
