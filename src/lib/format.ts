// Re-exports the currency-aware formatPrice. Components should prefer
// `useFormatPrice()` from `@/contexts/CurrencyContext` so the formatter
// reacts to currency changes. This static helper is kept for non-React
// callsites (e.g. SEO meta loaders, server-side string building) and
// always renders in the original currency without conversion.

import { formatCurrency, FALLBACK_CURRENCIES } from "@/lib/currency";

export function formatPrice(amount: number | null | undefined, currency: string) {
  const meta = FALLBACK_CURRENCIES.find((c) => c.code === currency);
  return formatCurrency(amount, currency, meta?.decimals);
}

export function trustLabel(score: number, level: string): { label: string; className: string } {
  if (score >= 80 || level === "gold" || level === "platinum") {
    return { label: "Highly Trusted", className: "bg-primary/10 text-primary border-primary/30" };
  }
  if (score >= 50 || level === "silver") {
    return { label: "Trusted", className: "bg-accent/15 text-accent-foreground border-accent/40" };
  }
  return { label: "New", className: "bg-secondary text-foreground/70 border-border" };
}

export const ZONE_STYLES: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-amber-100 text-amber-800 border-amber-300",
  C: "bg-rose-100 text-rose-800 border-rose-300",
};

export function countryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const cc = countryCode.toUpperCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}
