ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_subscription_tier_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY['free'::text, 'standard'::text, 'professional'::text, 'premium'::text, 'enterprise'::text]));