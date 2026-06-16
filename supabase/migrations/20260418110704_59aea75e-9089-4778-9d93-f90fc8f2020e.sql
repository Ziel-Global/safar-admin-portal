-- Watchlist table
CREATE TABLE public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrim_id uuid NOT NULL,
  package_id uuid NOT NULL,
  price_at_save numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pilgrim_id, package_id)
);

CREATE INDEX idx_watchlist_pilgrim ON public.watchlist(pilgrim_id);
CREATE INDEX idx_watchlist_package ON public.watchlist(package_id);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilgrims can view their own watchlist"
  ON public.watchlist FOR SELECT
  USING (pilgrim_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pilgrims can add to their watchlist"
  ON public.watchlist FOR INSERT
  WITH CHECK (pilgrim_id = auth.uid());

CREATE POLICY "Pilgrims can remove from their watchlist"
  ON public.watchlist FOR DELETE
  USING (pilgrim_id = auth.uid());

-- Price alerts table
CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrim_id uuid NOT NULL,
  package_id uuid NOT NULL,
  target_price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  is_active boolean NOT NULL DEFAULT true,
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_alerts_pilgrim ON public.price_alerts(pilgrim_id);
CREATE INDEX idx_price_alerts_package ON public.price_alerts(package_id);
CREATE INDEX idx_price_alerts_active ON public.price_alerts(is_active) WHERE is_active = true;

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilgrims can view their own alerts"
  ON public.price_alerts FOR SELECT
  USING (pilgrim_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pilgrims can create alerts"
  ON public.price_alerts FOR INSERT
  WITH CHECK (pilgrim_id = auth.uid());

CREATE POLICY "Pilgrims can update their own alerts"
  ON public.price_alerts FOR UPDATE
  USING (pilgrim_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pilgrims can delete their own alerts"
  ON public.price_alerts FOR DELETE
  USING (pilgrim_id = auth.uid());

-- Price history table
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_package ON public.price_history(package_id, recorded_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price history is public"
  ON public.price_history FOR SELECT
  USING (true);

-- Trigger: record price changes
CREATE OR REPLACE FUNCTION public.record_package_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.base_price IS DISTINCT FROM OLD.base_price AND NEW.base_price IS NOT NULL THEN
    INSERT INTO public.price_history (package_id, price, currency)
    VALUES (NEW.id, NEW.base_price, NEW.currency);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_package_price_change
AFTER UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.record_package_price_change();

-- Seed initial price history for existing active packages
INSERT INTO public.price_history (package_id, price, currency, recorded_at)
SELECT id, base_price, currency, created_at
FROM public.packages
WHERE base_price IS NOT NULL;