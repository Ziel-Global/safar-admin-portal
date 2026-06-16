-- RFQs table
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrim_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hajj','umrah','ramadan')),
  departure_city text NOT NULL,
  departure_country text NOT NULL,
  date_from date,
  date_to date,
  adults smallint NOT NULL DEFAULT 1 CHECK (adults >= 1),
  children smallint DEFAULT 0 CHECK (children >= 0),
  children_ages smallint[],
  accessibility_needs text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  budget_currency text DEFAULT 'GBP',
  zone_pref text DEFAULT 'any' CHECK (zone_pref IN ('any','A','B','C')),
  meal_pref text DEFAULT 'any',
  transport_pref text DEFAULT 'any',
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','quotes_received','comparing','booked','expired','cancelled')),
  matched_agents integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfqs_pilgrim ON public.rfqs(pilgrim_id);
CREATE INDEX idx_rfqs_status ON public.rfqs(status);

-- Quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  price_total numeric(10,2) NOT NULL,
  price_currency text NOT NULL DEFAULT 'GBP',
  price_breakdown jsonb DEFAULT '{}'::jsonb,
  hotel_name text,
  hotel_zone text CHECK (hotel_zone IN ('A','B','C')),
  valid_until date,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','viewed','accepted','declined','expired','withdrawn')),
  version smallint NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz
);

CREATE INDEX idx_quotes_rfq ON public.quotes(rfq_id);
CREATE INDEX idx_quotes_agent ON public.quotes(agent_id);

-- Matches table
CREATE TABLE public.rfq_agent_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  responded boolean NOT NULL DEFAULT false,
  responded_at timestamptz,
  UNIQUE (rfq_id, agent_id)
);

CREATE INDEX idx_matches_rfq ON public.rfq_agent_matches(rfq_id);
CREATE INDEX idx_matches_agent ON public.rfq_agent_matches(agent_id);

-- updated_at trigger for rfqs
CREATE TRIGGER trg_rfqs_touch
BEFORE UPDATE ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: RFQ owner
CREATE OR REPLACE FUNCTION public.is_rfq_owner(_rfq_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rfqs WHERE id = _rfq_id AND pilgrim_id = auth.uid())
$$;

-- Helper: agent matched to RFQ
CREATE OR REPLACE FUNCTION public.is_agent_matched_to_rfq(_rfq_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rfq_agent_matches m
    JOIN public.agents a ON a.id = m.agent_id
    WHERE m.rfq_id = _rfq_id AND a.user_id = auth.uid()
  )
$$;

-- Helper: agent owns this agent_id
CREATE OR REPLACE FUNCTION public.is_agent_owner(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.agents WHERE id = _agent_id AND user_id = auth.uid())
$$;

-- Match function
CREATE OR REPLACE FUNCTION public.match_agents_to_rfq(_rfq_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_type text;
  v_country text;
BEGIN
  SELECT type, departure_country INTO v_type, v_country
  FROM public.rfqs WHERE id = _rfq_id;

  IF v_type IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.rfq_agent_matches (rfq_id, agent_id)
  SELECT _rfq_id, a.id
  FROM public.agents a
  WHERE a.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.agent_id = a.id
        AND p.status = 'active'
        AND p.type = v_type
        AND p.departure_country = v_country
    )
  ON CONFLICT (rfq_id, agent_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.rfqs SET matched_agents = v_count WHERE id = _rfq_id;
  RETURN v_count;
END;
$$;

-- Enable RLS
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_agent_matches ENABLE ROW LEVEL SECURITY;

-- rfqs policies
CREATE POLICY "Pilgrims can view their own RFQs"
ON public.rfqs FOR SELECT
USING (auth.uid() = pilgrim_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Matched agents can view RFQs"
ON public.rfqs FOR SELECT
USING (public.is_agent_matched_to_rfq(id));

CREATE POLICY "Pilgrims can insert their own RFQs"
ON public.rfqs FOR INSERT
WITH CHECK (auth.uid() = pilgrim_id);

CREATE POLICY "Pilgrims can update their own RFQs"
ON public.rfqs FOR UPDATE
USING (auth.uid() = pilgrim_id);

CREATE POLICY "Admins can update any RFQ"
ON public.rfqs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- quotes policies
CREATE POLICY "Pilgrims can view quotes for their RFQs"
ON public.quotes FOR SELECT
USING (public.is_rfq_owner(rfq_id));

CREATE POLICY "Agents can view their own quotes"
ON public.quotes FOR SELECT
USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins can view all quotes"
ON public.quotes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can insert quotes for matched RFQs"
ON public.quotes FOR INSERT
WITH CHECK (
  public.is_agent_owner(agent_id) AND public.is_agent_matched_to_rfq(rfq_id)
);

CREATE POLICY "Agents can update their own quotes"
ON public.quotes FOR UPDATE
USING (public.is_agent_owner(agent_id));

CREATE POLICY "Pilgrims can update viewed quotes for their RFQs"
ON public.quotes FOR UPDATE
USING (public.is_rfq_owner(rfq_id));

-- rfq_agent_matches policies
CREATE POLICY "Pilgrims can view matches for their RFQs"
ON public.rfq_agent_matches FOR SELECT
USING (public.is_rfq_owner(rfq_id));

CREATE POLICY "Agents can view their own matches"
ON public.rfq_agent_matches FOR SELECT
USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins can view all matches"
ON public.rfq_agent_matches FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can update their own match (mark responded)"
ON public.rfq_agent_matches FOR UPDATE
USING (public.is_agent_owner(agent_id));