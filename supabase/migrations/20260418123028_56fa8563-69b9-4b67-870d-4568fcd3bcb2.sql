-- Currencies reference table
CREATE TABLE public.currencies (
  code text PRIMARY KEY,
  symbol text NOT NULL,
  name text NOT NULL,
  decimals smallint NOT NULL DEFAULT 2,
  flag_emoji text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currencies are public"
  ON public.currencies FOR SELECT
  USING (true);

CREATE POLICY "Admins manage currencies"
  ON public.currencies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Exchange rates table
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'USD' REFERENCES public.currencies(code),
  target_currency text NOT NULL REFERENCES public.currencies(code),
  rate numeric(14,6) NOT NULL CHECK (rate > 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exchange_rates_lookup
  ON public.exchange_rates (base_currency, target_currency, fetched_at DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates are public"
  ON public.exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins insert exchange rates"
  ON public.exchange_rates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update exchange rates"
  ON public.exchange_rates FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete exchange rates"
  ON public.exchange_rates FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed currencies
INSERT INTO public.currencies (code, symbol, name, decimals, flag_emoji, sort_order) VALUES
  ('GBP', '£', 'British Pound', 2, '🇬🇧', 1),
  ('USD', '$', 'US Dollar', 2, '🇺🇸', 2),
  ('EUR', '€', 'Euro', 2, '🇪🇺', 3),
  ('SAR', 'ر.س', 'Saudi Riyal', 2, '🇸🇦', 4),
  ('PKR', '₨', 'Pakistani Rupee', 0, '🇵🇰', 5),
  ('IDR', 'Rp', 'Indonesian Rupiah', 0, '🇮🇩', 6),
  ('TRY', '₺', 'Turkish Lira', 2, '🇹🇷', 7),
  ('BDT', '৳', 'Bangladeshi Taka', 0, '🇧🇩', 8),
  ('NGN', '₦', 'Nigerian Naira', 0, '🇳🇬', 9);

-- Seed approximate USD-base rates (April 2026 ballpark)
INSERT INTO public.exchange_rates (base_currency, target_currency, rate) VALUES
  ('USD', 'USD', 1.000000),
  ('USD', 'GBP', 0.790000),
  ('USD', 'EUR', 0.920000),
  ('USD', 'SAR', 3.750000),
  ('USD', 'PKR', 278.000000),
  ('USD', 'IDR', 16200.000000),
  ('USD', 'TRY', 38.500000),
  ('USD', 'BDT', 119.000000),
  ('USD', 'NGN', 1580.000000);

-- Conversion function
CREATE OR REPLACE FUNCTION public.convert_currency(
  amount numeric,
  from_curr text,
  to_curr text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_rate numeric;
  v_to_rate numeric;
  v_base text := 'USD';
BEGIN
  IF amount IS NULL THEN RETURN NULL; END IF;
  IF from_curr = to_curr THEN RETURN amount; END IF;

  SELECT rate INTO v_from_rate
  FROM public.exchange_rates
  WHERE base_currency = v_base AND target_currency = from_curr
  ORDER BY fetched_at DESC LIMIT 1;

  SELECT rate INTO v_to_rate
  FROM public.exchange_rates
  WHERE base_currency = v_base AND target_currency = to_curr
  ORDER BY fetched_at DESC LIMIT 1;

  IF v_from_rate IS NULL OR v_to_rate IS NULL OR v_from_rate = 0 THEN
    RETURN NULL;
  END IF;

  -- Convert from -> USD -> to
  RETURN ROUND((amount / v_from_rate) * v_to_rate, 6);
END;
$$;