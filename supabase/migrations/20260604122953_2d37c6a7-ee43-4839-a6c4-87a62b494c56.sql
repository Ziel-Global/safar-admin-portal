CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Backfill: end any active campaigns already past their end date
UPDATE public.campaigns
   SET status = 'ended', updated_at = now()
 WHERE status = 'active'
   AND end_date < CURRENT_DATE;

-- Daily job to auto-expire campaigns past their end date
SELECT cron.schedule(
  'expire-ended-campaigns',
  '5 0 * * *',
  $$
    UPDATE public.campaigns
       SET status = 'ended', updated_at = now()
     WHERE status = 'active'
       AND end_date < CURRENT_DATE;
  $$
);