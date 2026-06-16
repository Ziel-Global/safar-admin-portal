GRANT SELECT ON public.regulatory_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulatory_updates TO authenticated;
GRANT ALL ON public.regulatory_updates TO service_role;