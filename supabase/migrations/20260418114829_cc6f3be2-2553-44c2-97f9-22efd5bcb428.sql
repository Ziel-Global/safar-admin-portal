-- ============== package_tiers ==============
CREATE TABLE public.package_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  tier_name text NOT NULL CHECK (tier_name IN ('economy','standard','premium','vip')),
  hotel_override text,
  zone_override text,
  room_type text,
  transport_override text,
  meal_override text,
  price_adult numeric(10,2) NOT NULL,
  price_child numeric(10,2),
  currency text NOT NULL DEFAULT 'GBP',
  description_override text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_highlighted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, tier_name)
);

CREATE INDEX idx_package_tiers_package ON public.package_tiers(package_id);

ALTER TABLE public.package_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active tiers are public"
  ON public.package_tiers FOR SELECT
  USING (status = 'active' OR public.is_media_package_owner(package_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Agents can insert tiers for their packages"
  ON public.package_tiers FOR INSERT
  WITH CHECK (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can update tiers for their packages"
  ON public.package_tiers FOR UPDATE
  USING (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can delete tiers for their packages"
  ON public.package_tiers FOR DELETE
  USING (public.is_media_package_owner(package_id));

CREATE POLICY "Admins can update any tier"
  ON public.package_tiers FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_package_tiers_touch
  BEFORE UPDATE ON public.package_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Max 4 tiers per package + price ordering + single highlight
CREATE OR REPLACE FUNCTION public.guard_package_tiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_eco numeric;
  v_std numeric;
  v_prem numeric;
  v_vip numeric;
BEGIN
  -- Cap at 4 tiers per package on insert
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_count FROM public.package_tiers WHERE package_id = NEW.package_id;
    IF v_count >= 4 THEN
      RAISE EXCEPTION 'A package can have at most 4 tiers';
    END IF;
  END IF;

  -- Enforce single highlight per package
  IF NEW.is_highlighted = true THEN
    UPDATE public.package_tiers
       SET is_highlighted = false
     WHERE package_id = NEW.package_id
       AND id <> NEW.id
       AND is_highlighted = true;
  END IF;

  -- Price ordering across all tiers of this package after this change
  SELECT MAX(CASE WHEN tier_name='economy'  THEN price_adult END),
         MAX(CASE WHEN tier_name='standard' THEN price_adult END),
         MAX(CASE WHEN tier_name='premium'  THEN price_adult END),
         MAX(CASE WHEN tier_name='vip'      THEN price_adult END)
    INTO v_eco, v_std, v_prem, v_vip
  FROM (
    SELECT tier_name, price_adult
      FROM public.package_tiers
     WHERE package_id = NEW.package_id AND id <> NEW.id
    UNION ALL
    SELECT NEW.tier_name, NEW.price_adult
  ) t;

  IF v_eco IS NOT NULL AND v_std  IS NOT NULL AND v_eco  > v_std  THEN
    RAISE EXCEPTION 'Economy price (%) must be <= Standard price (%)', v_eco, v_std;
  END IF;
  IF v_std IS NOT NULL AND v_prem IS NOT NULL AND v_std  > v_prem THEN
    RAISE EXCEPTION 'Standard price (%) must be <= Premium price (%)', v_std, v_prem;
  END IF;
  IF v_prem IS NOT NULL AND v_vip IS NOT NULL AND v_prem > v_vip  THEN
    RAISE EXCEPTION 'Premium price (%) must be <= VIP price (%)', v_prem, v_vip;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_package_tiers
  BEFORE INSERT OR UPDATE ON public.package_tiers
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_tiers();

-- ============== package_availability ==============
CREATE TABLE public.package_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  date date NOT NULL,
  available_slots smallint NOT NULL DEFAULT 0,
  booked_slots smallint NOT NULL DEFAULT 0,
  price_override numeric(10,2),
  is_blackout boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, date)
);

CREATE INDEX idx_package_availability_package_date ON public.package_availability(package_id, date);

ALTER TABLE public.package_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability is public"
  ON public.package_availability FOR SELECT
  USING (true);

CREATE POLICY "Agents can insert availability for their packages"
  ON public.package_availability FOR INSERT
  WITH CHECK (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can update availability for their packages"
  ON public.package_availability FOR UPDATE
  USING (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can delete availability for their packages"
  ON public.package_availability FOR DELETE
  USING (public.is_media_package_owner(package_id));

CREATE POLICY "Admins can update any availability"
  ON public.package_availability FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_package_availability_touch
  BEFORE UPDATE ON public.package_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Guard: booked_slots cannot exceed available_slots
CREATE OR REPLACE FUNCTION public.guard_package_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booked_slots < 0 THEN
    RAISE EXCEPTION 'booked_slots cannot be negative';
  END IF;
  IF NEW.available_slots < 0 THEN
    RAISE EXCEPTION 'available_slots cannot be negative';
  END IF;
  IF NEW.booked_slots > NEW.available_slots THEN
    RAISE EXCEPTION 'booked_slots (%) cannot exceed available_slots (%)', NEW.booked_slots, NEW.available_slots;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_package_availability
  BEFORE INSERT OR UPDATE ON public.package_availability
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_availability();