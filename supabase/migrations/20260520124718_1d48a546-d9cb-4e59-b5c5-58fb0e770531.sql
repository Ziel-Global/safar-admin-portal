
CREATE OR REPLACE FUNCTION public.trg_match_agents_after_rfq_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.match_agents_to_rfq(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfqs_match_agents ON public.rfqs;
CREATE TRIGGER trg_rfqs_match_agents
AFTER INSERT ON public.rfqs
FOR EACH ROW
EXECUTE FUNCTION public.trg_match_agents_after_rfq_insert();

-- Backfill: run match for any RFQ that has no matches yet
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.rfqs
    WHERE NOT EXISTS (SELECT 1 FROM public.rfq_agent_matches m WHERE m.rfq_id = rfqs.id)
  LOOP
    PERFORM public.match_agents_to_rfq(r.id);
  END LOOP;
END $$;
