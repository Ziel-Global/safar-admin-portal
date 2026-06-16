ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_status_check;

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'ended'::text, 'cancelled'::text]));