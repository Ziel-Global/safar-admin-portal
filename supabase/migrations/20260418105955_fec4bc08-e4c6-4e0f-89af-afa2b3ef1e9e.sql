-- 1. badge_types reference table
CREATE TABLE public.badge_types (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_name text NOT NULL,
  color_hex text NOT NULL,
  help_url text,
  authority text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badge types are viewable by everyone"
  ON public.badge_types FOR SELECT USING (true);

CREATE POLICY "Admins can manage badge types"
  ON public.badge_types FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. agent_badges table
CREATE TABLE public.agent_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  badge_type text NOT NULL REFERENCES public.badge_types(id) ON DELETE RESTRICT,
  document_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','expired','rejected')),
  rejection_reason text,
  verified_at timestamptz,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, badge_type)
);

CREATE INDEX idx_agent_badges_agent ON public.agent_badges(agent_id);
CREATE INDEX idx_agent_badges_status ON public.agent_badges(status);

ALTER TABLE public.agent_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified badges are public"
  ON public.agent_badges FOR SELECT
  USING (status = 'verified' OR public.is_agent_owner(agent_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Agents can submit their own badges"
  ON public.agent_badges FOR INSERT
  WITH CHECK (public.is_agent_owner(agent_id));

CREATE POLICY "Agents can update their own pending badges"
  ON public.agent_badges FOR UPDATE
  USING (public.is_agent_owner(agent_id) AND status IN ('pending','rejected','expired'));

CREATE POLICY "Admins can update any badge"
  ON public.agent_badges FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Agents can delete their own pending badges"
  ON public.agent_badges FOR DELETE
  USING (public.is_agent_owner(agent_id) AND status IN ('pending','rejected'));

CREATE TRIGGER touch_agent_badges
  BEFORE UPDATE ON public.agent_badges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Verification level recalculation trigger
CREATE OR REPLACE FUNCTION public.recalculate_verification_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid;
  v_count integer;
  v_level text;
BEGIN
  v_agent := COALESCE(NEW.agent_id, OLD.agent_id);
  SELECT COUNT(*) INTO v_count
  FROM public.agent_badges
  WHERE agent_id = v_agent AND status = 'verified';

  v_level := CASE
    WHEN v_count >= 4 THEN 'platinum'
    WHEN v_count = 3 THEN 'gold'
    WHEN v_count = 2 THEN 'silver'
    WHEN v_count = 1 THEN 'bronze'
    ELSE 'none'
  END;

  UPDATE public.agents SET verification_level = v_level WHERE id = v_agent;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_verification_level
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_badges
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_verification_level();

-- 4. Auto-stamp verified_at when status flips to verified
CREATE OR REPLACE FUNCTION public.stamp_badge_verified_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    NEW.verified_at := now();
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_badge_verified
  BEFORE UPDATE ON public.agent_badges
  FOR EACH ROW EXECUTE FUNCTION public.stamp_badge_verified_at();

-- 5. Seed badge types
INSERT INTO public.badge_types (id, name, description, icon_name, color_hex, help_url, authority) VALUES
  ('atol', 'ATOL Protected', 'Air Travel Organisers Licensing — your money is protected if the agent fails.', 'Shield', '#2563EB', 'https://www.caa.co.uk/atol', 'UK Civil Aviation Authority'),
  ('maqam', 'Maqam Registered', 'Approved by the Saudi Maqam platform to handle Hajj & Umrah pilgrims.', 'Moon', '#16A34A', 'https://maqam.haj.gov.sa', 'Saudi Ministry of Hajj & Umrah'),
  ('ministry', 'Ministry Licensed', 'Licensed by the national ministry of tourism or religious affairs.', 'Building2', '#0D9488', NULL, 'National Ministry'),
  ('iata', 'IATA Accredited', 'Accredited by the International Air Transport Association to issue tickets.', 'Plane', '#1E3A5F', 'https://www.iata.org/en/programs/accreditation-travel/', 'International Air Transport Association');

-- 6. Private storage bucket for credential documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-credentials', 'agent-credentials', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agents can upload their own credentials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'agent-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Agents can view their own credentials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'agent-credentials'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Agents can update their own credentials"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'agent-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Agents can delete their own credentials"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'agent-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );