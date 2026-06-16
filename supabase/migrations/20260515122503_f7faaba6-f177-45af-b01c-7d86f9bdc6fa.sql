CREATE OR REPLACE FUNCTION public.match_agents_to_rfq(_rfq_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Primary match: any active agent that has at least one active package of the
  -- same trip type. Departure country is intentionally NOT required because
  -- agents commonly serve multiple departure markets and would otherwise miss
  -- legitimate leads. If still no match, fall back to all active agents so the
  -- pilgrim's request is never silently dropped.
  INSERT INTO public.rfq_agent_matches (rfq_id, agent_id)
  SELECT _rfq_id, a.id
  FROM public.agents a
  WHERE a.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.agent_id = a.id
        AND p.status = 'active'
        AND p.type = v_type
    )
  ON CONFLICT (rfq_id, agent_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    INSERT INTO public.rfq_agent_matches (rfq_id, agent_id)
    SELECT _rfq_id, a.id
    FROM public.agents a
    WHERE a.status = 'active'
    ON CONFLICT (rfq_id, agent_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

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
$function$;