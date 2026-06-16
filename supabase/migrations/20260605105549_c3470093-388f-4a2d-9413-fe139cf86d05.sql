-- 1) Restrict profile visibility to the owner or admins
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2) Remove the public INSERT policy on featured_metrics
DROP POLICY IF EXISTS "Record metric for active campaigns" ON public.featured_metrics;
