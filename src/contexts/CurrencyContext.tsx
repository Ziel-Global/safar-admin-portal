import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  convertAmount,
  formatCurrency,
  DEFAULT_CURRENCY,
  FALLBACK_CURRENCIES,
  FALLBACK_RATES,
  type CurrencyMeta,
  type RatesMap,
} from "@/lib/currency";

const STORAGE_KEY = "safar.preferredCurrency";

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => Promise<void> | void;
  currencies: CurrencyMeta[];
  rates: RatesMap;
  ratesUpdatedAt: string | null;
  formatPrice: (amount: number | null | undefined, originalCurrency: string) => string;
  convertPrice: (amount: number | null | undefined, originalCurrency: string) => number | null;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function readGuestCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, profile, refresh } = useAuth();
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [currencies, setCurrencies] = useState<CurrencyMeta[]>(FALLBACK_CURRENCIES);
  const [rates, setRates] = useState<RatesMap>(FALLBACK_RATES);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);

  // Initialise currency from profile (logged-in) or localStorage (guest)
  useEffect(() => {
    if (profile?.preferred_currency) {
      setCurrencyState(profile.preferred_currency);
    } else if (!user) {
      setCurrencyState(readGuestCurrency());
    }
  }, [profile, user]);

  // Load currencies + latest rates once
  const loadRates = useCallback(async () => {
    const [{ data: curList }, { data: rateRows }] = await Promise.all([
      supabase.from("currencies").select("*").order("sort_order"),
      supabase
        .from("exchange_rates")
        .select("base_currency, target_currency, rate, fetched_at")
        .eq("base_currency", "USD")
        .order("fetched_at", { ascending: false }),
    ]);
    if (curList && curList.length > 0) {
      setCurrencies(curList as unknown as CurrencyMeta[]);
    }
    if (rateRows && rateRows.length > 0) {
      const latest: RatesMap = {};
      let newest: string | null = null;
      for (const row of rateRows as Array<{
        target_currency: string;
        rate: number;
        fetched_at: string;
      }>) {
        if (!(row.target_currency in latest)) {
          latest[row.target_currency] = Number(row.rate);
        }
        if (!newest || row.fetched_at > newest) newest = row.fetched_at;
      }
      setRates({ ...FALLBACK_RATES, ...latest });
      setRatesUpdatedAt(newest);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const setCurrency = useCallback(
    async (code: string) => {
      setCurrencyState(code);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, code);
        } catch {}
      }
      if (user) {
        await supabase.from("profiles").update({ preferred_currency: code }).eq("id", user.id);
        await refresh();
      }
    },
    [user, refresh],
  );

  const convertPrice = useCallback(
    (amount: number | null | undefined, originalCurrency: string) =>
      convertAmount(amount, originalCurrency, currency, rates),
    [currency, rates],
  );

  const formatPrice = useCallback(
    (amount: number | null | undefined, originalCurrency: string) => {
      if (amount == null) return "-";
      const target = currencies.find((c) => c.code === currency);
      const dp = target?.decimals ?? 2;
      const converted = convertAmount(amount, originalCurrency, currency, rates);
      if (converted == null) {
        // Fall back to original-currency formatting
        const orig = currencies.find((c) => c.code === originalCurrency);
        return formatCurrency(amount, originalCurrency, orig?.decimals);
      }
      return formatCurrency(converted, currency, dp);
    },
    [currency, currencies, rates],
  );

  const refreshRates = useCallback(async () => {
    await loadRates();
  }, [loadRates]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      currencies,
      rates,
      ratesUpdatedAt,
      formatPrice,
      convertPrice,
      refreshRates,
    }),
    [currency, setCurrency, currencies, rates, ratesUpdatedAt, formatPrice, convertPrice, refreshRates],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}

/** Convenience hook that returns just the formatter - drop-in replacement for the old formatPrice. */
export function useFormatPrice() {
  return useCurrency().formatPrice;
}
