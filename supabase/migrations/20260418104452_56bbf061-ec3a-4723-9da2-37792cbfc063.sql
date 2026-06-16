
-- LEADS table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  pilgrim_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quote_sent','awaiting_deposit','confirmed','completed','lost')),
  pilgrim_name text,
  trip_type text,
  departure_date date,
  group_size smallint,
  budget_range text,
  source text NOT NULL DEFAULT 'search',
  source_detail jsonb DEFAULT '{}'::jsonb,
  score smallint NOT NULL DEFAULT 50,
  tags text[],
  lost_reason text,
  snoozed_until timestamptz,
  first_response_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, rfq_id)
);

CREATE INDEX idx_leads_agent_status ON public.leads(agent_id, status);
CREATE INDEX idx_leads_rfq ON public.leads(rfq_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their own leads"
  ON public.leads FOR SELECT
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins can view all leads"
  ON public.leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can update their own leads"
  ON public.leads FOR UPDATE
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents can delete their own leads"
  ON public.leads FOR DELETE
  USING (public.is_agent_owner(agent_id));

-- inserts only via SECURITY DEFINER functions/triggers
CREATE POLICY "Block direct lead inserts"
  ON public.leads FOR INSERT
  WITH CHECK (false);

CREATE TRIGGER trg_leads_touch
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- LEAD NOTES table
CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id, created_at DESC);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- helper to check ownership of a lead
CREATE OR REPLACE FUNCTION public.is_lead_owner(_lead_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.agents a ON a.id = l.agent_id
    WHERE l.id = _lead_id AND a.user_id = auth.uid()
  )
$$;

CREATE POLICY "Agents can view notes on their leads"
  ON public.lead_notes FOR SELECT
  USING (public.is_lead_owner(lead_id));

CREATE POLICY "Admins can view all lead notes"
  ON public.lead_notes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can add notes to their leads"
  ON public.lead_notes FOR INSERT
  WITH CHECK (public.is_lead_owner(lead_id) AND user_id = auth.uid());

CREATE POLICY "Agents can delete their own notes"
  ON public.lead_notes FOR DELETE
  USING (user_id = auth.uid() AND public.is_lead_owner(lead_id));

-- Update match_agents_to_rfq to also create lead rows
CREATE OR REPLACE FUNCTION public.match_agents_to_rfq(_rfq_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_type text;
  v_country text;
  v_city text;
  v_pilgrim uuid;
  v_pilgrim_name text;
  v_date_from date;
  v_adults smallint;
  v_children smallint;
  v_budget_min numeric;
  v_budget_max numeric;
  v_budget_currency text;
  v_budget_range text;
  v_group_size smallint;
BEGIN
  SELECT type, departure_country, departure_city, pilgrim_id, date_from,
         adults, children, budget_min, budget_max, budget_currency
    INTO v_type, v_country, v_city, v_pilgrim, v_date_from,
         v_adults, v_children, v_budget_min, v_budget_max, v_budget_currency
  FROM public.rfqs WHERE id = _rfq_id;

  IF v_type IS NULL THEN
    RETURN 0;
  END IF;

  SELECT full_name INTO v_pilgrim_name FROM public.profiles WHERE id = v_pilgrim;

  v_group_size := COALESCE(v_adults, 0) + COALESCE(v_children, 0);
  v_budget_range := CASE
    WHEN v_budget_min IS NOT NULL AND v_budget_max IS NOT NULL
      THEN COALESCE(v_budget_currency,'GBP') || ' ' || v_budget_min::text || '–' || v_budget_max::text
    WHEN v_budget_max IS NOT NULL
      THEN 'Up to ' || COALESCE(v_budget_currency,'GBP') || ' ' || v_budget_max::text
    ELSE NULL
  END;

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

  -- create matching leads
  INSERT INTO public.leads (
    agent_id, rfq_id, pilgrim_id, status, pilgrim_name, trip_type,
    departure_date, group_size, budget_range, source, source_detail
  )
  SELECT m.agent_id, _rfq_id, v_pilgrim, 'new',
         COALESCE(v_pilgrim_name, 'Anonymous'),
         v_type, v_date_from, v_group_size, v_budget_range,
         'rfq_match',
         jsonb_build_object('city', v_city, 'country', v_country)
  FROM public.rfq_agent_matches m
  WHERE m.rfq_id = _rfq_id
  ON CONFLICT (agent_id, rfq_id) DO NOTHING;

  UPDATE public.rfqs SET matched_agents = v_count WHERE id = _rfq_id;
  RETURN v_count;
END;
$$;

-- When a quote is sent, ensure a lead exists and bump its status
CREATE OR REPLACE FUNCTION public.upsert_lead_on_quote()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pilgrim uuid;
  v_type text;
  v_city text;
  v_country text;
  v_date_from date;
  v_adults smallint;
  v_children smallint;
  v_pilgrim_name text;
  v_budget_min numeric;
  v_budget_max numeric;
  v_budget_currency text;
  v_budget_range text;
BEGIN
  SELECT pilgrim_id, type, departure_city, departure_country, date_from,
         adults, children, budget_min, budget_max, budget_currency
    INTO v_pilgrim, v_type, v_city, v_country, v_date_from,
         v_adults, v_children, v_budget_min, v_budget_max, v_budget_currency
  FROM public.rfqs WHERE id = NEW.rfq_id;

  SELECT full_name INTO v_pilgrim_name FROM public.profiles WHERE id = v_pilgrim;

  v_budget_range := CASE
    WHEN v_budget_min IS NOT NULL AND v_budget_max IS NOT NULL
      THEN COALESCE(v_budget_currency,'GBP') || ' ' || v_budget_min::text || '–' || v_budget_max::text
    ELSE NULL
  END;

  INSERT INTO public.leads (
    agent_id, rfq_id, pilgrim_id, status, pilgrim_name, trip_type,
    departure_date, group_size, budget_range, source, first_response_at
  ) VALUES (
    NEW.agent_id, NEW.rfq_id, v_pilgrim, 'quote_sent',
    COALESCE(v_pilgrim_name, 'Anonymous'),
    v_type, v_date_from,
    COALESCE(v_adults,0) + COALESCE(v_children,0),
    v_budget_range, 'quote', now()
  )
  ON CONFLICT (agent_id, rfq_id) DO UPDATE
    SET status = CASE WHEN public.leads.status IN ('new','contacted') THEN 'quote_sent' ELSE public.leads.status END,
        first_response_at = COALESCE(public.leads.first_response_at, now()),
        updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quote_to_lead
  AFTER INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.upsert_lead_on_quote();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
