-- Auto-expire campaigns whose end date has passed
CREATE OR REPLACE FUNCTION public.expire_ended_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.campaigns
     SET status = 'ended',
         updated_at = now()
   WHERE status = 'active'
     AND end_date < (now() AT TIME ZONE 'utc')::date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Run the expiry immediately to normalise existing data
SELECT public.expire_ended_campaigns();

-- Schedule it to run daily just after midnight UTC
SELECT cron.schedule(
  'expire-ended-campaigns-daily',
  '5 0 * * *',
  $$ SELECT public.expire_ended_campaigns(); $$
);