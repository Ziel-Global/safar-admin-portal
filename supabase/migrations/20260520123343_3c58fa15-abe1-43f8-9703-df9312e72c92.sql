ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_verification_level_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_verification_level_check
  CHECK (verification_level = ANY (ARRAY['none'::text, 'bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text]));