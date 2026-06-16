// Fetches latest USD-base FX rates from exchangerate.host (free, no key required)
// and upserts them into public.exchange_rates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPPORTED = ["GBP", "USD", "EUR", "SAR", "PKR", "IDR", "TRY", "BDT", "NGN"];

const FALLBACK: Record<string, number> = {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let rates: Record<string, number> = { ...FALLBACK };
    let source = "fallback";

    try {
      const symbols = SUPPORTED.filter((c) => c !== "USD").join(",");
      const url = `https://api.exchangerate.host/latest?base=USD&symbols=${symbols}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.rates && typeof data.rates === "object") {
          rates = { USD: 1, ...data.rates };
          source = "exchangerate.host";
        }
      }
    } catch (err) {
      console.warn("FX fetch failed, using fallback rates", err);
    }

    const fetched_at = new Date().toISOString();
    const rows = Object.entries(rates)
      .filter(([code]) => SUPPORTED.includes(code))
      .map(([target_currency, rate]) => ({
        base_currency: "USD",
        target_currency,
        rate: Number(rate),
        fetched_at,
      }));

    const { error } = await admin.from("exchange_rates").insert(rows);
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, source, count: rows.length, fetched_at, rates }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fetch-exchange-rates error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
