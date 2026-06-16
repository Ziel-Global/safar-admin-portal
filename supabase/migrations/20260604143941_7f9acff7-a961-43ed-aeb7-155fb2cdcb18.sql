CREATE OR REPLACE FUNCTION public.expire_enforcement_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  r record;
  v_has_active_high boolean;
BEGIN
  -- Expire any active, time-limited actions whose window has passed
  FOR r IN
    SELECT id, agent_id, level
    FROM public.enforcement_actions
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  LOOP
    UPDATE public.enforcement_actions
       SET status = 'expired'
     WHERE id = r.id;
    v_count := v_count + 1;

    -- If this was a suspension/ban, restore the agent only when no other
    -- active high-level (>=3) action remains.
    IF r.level >= 3 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.enforcement_actions
        WHERE agent_id = r.agent_id
          AND status = 'active'
          AND level >= 3
          AND id <> r.id
      ) INTO v_has_active_high;

      IF NOT v_has_active_high THEN
        UPDATE public.agents
           SET status = 'active'
         WHERE id = r.agent_id
           AND status IN ('suspended', 'banned');
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expire-enforcement-actions',
  '*/15 * * * *',
  $$ SELECT public.expire_enforcement_actions(); $$
);