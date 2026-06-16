
-- =========================================
-- 1. duplicate_package function
-- =========================================
CREATE OR REPLACE FUNCTION public.duplicate_package(package_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_agent_id uuid;
BEGIN
  SELECT agent_id INTO v_agent_id FROM public.packages WHERE id = package_uuid;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;
  IF NOT public.is_package_owner(v_agent_id) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to duplicate this package';
  END IF;

  INSERT INTO public.packages (
    agent_id, title, type, departure_city, departure_country,
    base_price, currency, hotel_name, hotel_stars, hotel_zone,
    distance_to_haram_m, meals_included, transport_type, visa_included,
    group_size_min, group_size_max, accessibility, thumbnail_url, status,
    date_start, date_end
  )
  SELECT
    agent_id, title || ' (Copy)', type, departure_city, departure_country,
    base_price, currency, hotel_name, hotel_stars, hotel_zone,
    distance_to_haram_m, meals_included, transport_type, visa_included,
    group_size_min, group_size_max, accessibility, thumbnail_url, 'draft',
    NULL, NULL
  FROM public.packages WHERE id = package_uuid
  RETURNING id INTO v_new_id;

  -- Copy tiers
  INSERT INTO public.package_tiers (
    package_id, tier_name, hotel_override, zone_override, room_type,
    transport_override, meal_override, price_adult, price_child, currency,
    description_override, sort_order, is_highlighted, status
  )
  SELECT
    v_new_id, tier_name, hotel_override, zone_override, room_type,
    transport_override, meal_override, price_adult, price_child, currency,
    description_override, sort_order, is_highlighted, status
  FROM public.package_tiers WHERE package_id = package_uuid;

  -- Copy media (without availability — that's intentionally reset)
  INSERT INTO public.package_media (
    package_id, url, thumbnail_url, label, sort_order, is_primary, media_type, moderation_status
  )
  SELECT
    v_new_id, url, thumbnail_url, label, sort_order, is_primary, media_type, moderation_status
  FROM public.package_media WHERE package_id = package_uuid;

  RETURN v_new_id;
END;
$$;

-- =========================================
-- 2. package_templates table
-- =========================================
CREATE TABLE public.package_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  name text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_package_templates_agent ON public.package_templates(agent_id);

ALTER TABLE public.package_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view their own templates"
ON public.package_templates FOR SELECT
USING (public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents create their own templates"
ON public.package_templates FOR INSERT
WITH CHECK (public.is_agent_owner(agent_id));

CREATE POLICY "Agents update their own templates"
ON public.package_templates FOR UPDATE
USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents delete their own templates"
ON public.package_templates FOR DELETE
USING (public.is_agent_owner(agent_id));

CREATE TRIGGER trg_package_templates_updated_at
BEFORE UPDATE ON public.package_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- 3. create_package_from_template function
-- =========================================
CREATE OR REPLACE FUNCTION public.create_package_from_template(template_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_agent_id uuid;
  v_data jsonb;
BEGIN
  SELECT agent_id, template_data INTO v_agent_id, v_data
  FROM public.package_templates WHERE id = template_uuid;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  IF NOT public.is_agent_owner(v_agent_id) THEN
    RAISE EXCEPTION 'Not authorised to use this template';
  END IF;

  INSERT INTO public.packages (
    agent_id, title, type, departure_city, departure_country,
    base_price, currency, hotel_name, hotel_stars, hotel_zone,
    distance_to_haram_m, meals_included, transport_type, visa_included,
    group_size_min, group_size_max, accessibility, status
  ) VALUES (
    v_agent_id,
    COALESCE(v_data->>'title', 'Untitled package'),
    COALESCE(v_data->>'type', 'umrah'),
    COALESCE(v_data->>'departure_city', 'London'),
    COALESCE(v_data->>'departure_country', 'GB'),
    NULLIF(v_data->>'base_price','')::numeric,
    COALESCE(v_data->>'currency', 'GBP'),
    v_data->>'hotel_name',
    NULLIF(v_data->>'hotel_stars','')::smallint,
    v_data->>'hotel_zone',
    NULLIF(v_data->>'distance_to_haram_m','')::integer,
    v_data->>'meals_included',
    v_data->>'transport_type',
    COALESCE((v_data->>'visa_included')::boolean, false),
    NULLIF(v_data->>'group_size_min','')::smallint,
    NULLIF(v_data->>'group_size_max','')::smallint,
    COALESCE((v_data->>'accessibility')::boolean, false),
    'draft'
  )
  RETURNING id INTO v_new_id;

  UPDATE public.package_templates
    SET usage_count = usage_count + 1
    WHERE id = template_uuid;

  RETURN v_new_id;
END;
$$;

-- =========================================
-- 4. campaigns + campaign_packages tables
-- =========================================
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('ramadan','holiday','last_minute','early_bird','custom')),
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','ended','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_dates_chk CHECK (end_date >= start_date)
);

CREATE INDEX idx_campaigns_agent ON public.campaigns(agent_id);
CREATE INDEX idx_campaigns_active ON public.campaigns(status, start_date, end_date);

CREATE TABLE public.campaign_packages (
  campaign_id uuid NOT NULL,
  package_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, package_id)
);

CREATE INDEX idx_campaign_packages_pkg ON public.campaign_packages(package_id);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_packages ENABLE ROW LEVEL SECURITY;

-- campaigns RLS
CREATE POLICY "Active campaigns are public"
ON public.campaigns FOR SELECT
USING (
  status = 'active'
  OR public.is_agent_owner(agent_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Agents create their own campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (public.is_agent_owner(agent_id));

CREATE POLICY "Agents update their own campaigns"
ON public.campaigns FOR UPDATE
USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents delete their own campaigns"
ON public.campaigns FOR DELETE
USING (public.is_agent_owner(agent_id));

-- helper: is campaign owner
CREATE OR REPLACE FUNCTION public.is_campaign_owner(_campaign_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.agents a ON a.id = c.agent_id
    WHERE c.id = _campaign_id AND a.user_id = auth.uid()
  )
$$;

-- campaign_packages RLS
CREATE POLICY "Campaign packages public for active campaigns"
ON public.campaign_packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND (c.status = 'active' OR public.is_campaign_owner(c.id) OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Agents add packages to their campaigns"
ON public.campaign_packages FOR INSERT
WITH CHECK (
  public.is_campaign_owner(campaign_id)
  AND EXISTS (
    SELECT 1 FROM public.packages p
    WHERE p.id = package_id AND public.is_package_owner(p.agent_id)
  )
);

CREATE POLICY "Agents remove packages from their campaigns"
ON public.campaign_packages FOR DELETE
USING (public.is_campaign_owner(campaign_id));

CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
