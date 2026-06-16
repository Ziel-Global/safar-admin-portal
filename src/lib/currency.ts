// Currency conversion + formatting utilities (pure, no React)

export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  flag_emoji: string | null;
  sort_order: number;
}

export interface ExchangeRate {
  base_currency: string;
  target_currency: string;
  rate: number;
  fetched_at: string;
}

export type RatesMap = Record<string, number>; // currency code -> rate from USD base

export const DEFAULT_CURRENCY = "GBP";
export const FALLBACK_DECIMALS = 2;

// Approximate fallback rates (USD base) - used until live data arrives.
export const FALLBACK_RATES: RatesMap = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  SAR: 3.75,
  PKR: 278,
  IDR: 16200,
  TRY: 38.5,
  BDT: 119,
  NGN: 1580,
};

export const FALLBACK_CURRENCIES: CurrencyMeta[] = [
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, flag_emoji: "🇬🇧", sort_order: 1 },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, flag_emoji: "🇺🇸", sort_order: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2, flag_emoji: "🇪🇺", sort_order: 3 },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", decimals: 2, flag_emoji: "🇸🇦", sort_order: 4 },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", decimals: 0, flag_emoji: "🇵🇰", sort_order: 5 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", decimals: 0, flag_emoji: "🇮🇩", sort_order: 6 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", decimals: 2, flag_emoji: "🇹🇷", sort_order: 7 },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", decimals: 0, flag_emoji: "🇧🇩", sort_order: 8 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimals: 0, flag_emoji: "🇳🇬", sort_order: 9 },
];

/**
 * Convert via USD base. Uses integer-cent arithmetic to avoid float drift on display.
 * Returns null if either rate is unknown.
 */
export function convertAmount(
  amount: number | null | undefined,
  from: string,
  to: string,
  rates: RatesMap,
): number | null {
  if (amount == null || !isFinite(amount)) return null;
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  // amount(from) -> USD -> target. Round to 6dp to avoid float artifacts.
  const usd = amount / fromRate;
  const result = usd * toRate;
  return Math.round(result * 1_000_000) / 1_000_000;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string,
  decimals?: number,
): string {
  if (amount == null) return "-";
  const dp = decimals ?? FALLBACK_DECIMALS;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: dp,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Some symbols (e.g., custom decimals=0) - fall back to manual
    const meta = FALLBACK_CURRENCIES.find((c) => c.code === currency);
    const sym = meta?.symbol ?? currency;
    const rounded = Number(amount.toFixed(dp));
    return `${sym} ${rounded.toLocaleString(undefined, { maximumFractionDigits: dp })}`;
  }
}
