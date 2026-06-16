-- Packages table
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text UNIQUE,
  type text NOT NULL CHECK (type IN ('hajj','umrah','ramadan')),
  departure_city text NOT NULL,
  departure_country text NOT NULL,
  date_start date,
  date_end date,
  base_price numeric(10,2),
  currency text NOT NULL DEFAULT 'GBP',
  hotel_name text,
  hotel_stars smallint CHECK (hotel_stars BETWEEN 1 AND 5),
  hotel_zone text CHECK (hotel_zone IN ('A','B','C')),
  distance_to_haram_m integer,
  meals_included text CHECK (meals_included IN ('full','half','self')),
  transport_type text CHECK (transport_type IN ('private','shared','self')),
  visa_included boolean NOT NULL DEFAULT false,
  group_size_min smallint,
  group_size_max smallint,
  accessibility boolean NOT NULL DEFAULT false,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','sold_out','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_packages_agent_id ON public.packages(agent_id);
CREATE INDEX idx_packages_status ON public.packages(status);
CREATE INDEX idx_packages_type ON public.packages(type);

-- Auto-generate slug from title
CREATE OR REPLACE FUNCTION public.set_package_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter integer := 0;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.slug IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.title IS DISTINCT FROM OLD.title AND NEW.slug = OLD.slug) THEN
    base_slug := public.slugify(NEW.title);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'package';
    END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.packages WHERE slug = candidate AND id <> NEW.id) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER packages_set_slug
BEFORE INSERT OR UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.set_package_slug();

-- Auto-update updated_at
CREATE TRIGGER packages_touch_updated_at
BEFORE UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Helper: check if current user owns the agent
CREATE OR REPLACE FUNCTION public.is_package_owner(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agents
    WHERE id = _agent_id AND user_id = auth.uid()
  )
$$;

-- RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active packages are viewable by everyone"
ON public.packages
FOR SELECT
USING (
  status = 'active'
  OR public.is_package_owner(agent_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Agents can insert their own packages"
ON public.packages
FOR INSERT
WITH CHECK (public.is_package_owner(agent_id));

CREATE POLICY "Agents can update their own packages"
ON public.packages
FOR UPDATE
USING (public.is_package_owner(agent_id));

CREATE POLICY "Agents can delete their own packages"
ON public.packages
FOR DELETE
USING (public.is_package_owner(agent_id));

CREATE POLICY "Admins can update any package"
ON public.packages
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any package"
ON public.packages
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));