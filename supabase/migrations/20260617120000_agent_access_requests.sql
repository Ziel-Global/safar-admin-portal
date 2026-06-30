CREATE TABLE IF NOT EXISTS public.agent_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  country_code text,
  business_name text NOT NULL,
  city text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rejected', 'invited', 'completed')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  invited_at timestamptz,
  completed_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_access_requests_status_idx
  ON public.agent_access_requests (status, created_at DESC);

ALTER TABLE public.agent_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit agent access requests" ON public.agent_access_requests;
CREATE POLICY "Public can submit agent access requests"
  ON public.agent_access_requests FOR INSERT
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admins can view agent access requests" ON public.agent_access_requests;
CREATE POLICY "Admins can view agent access requests"
  ON public.agent_access_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update agent access requests" ON public.agent_access_requests;
CREATE POLICY "Admins can update agent access requests"
  ON public.agent_access_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_agent_invite_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_request_id uuid;
BEGIN
  v_meta := NEW.raw_user_meta_data;
  IF COALESCE(v_meta ->> 'agent_invite', '') <> 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agents (user_id, business_name, city, country_code, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(v_meta ->> 'business_name'), ''), 'New Agent'),
    NULLIF(trim(v_meta ->> 'city'), ''),
    NULLIF(trim(v_meta ->> 'country_code'), ''),
    'active'
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF v_meta ? 'access_request_id' AND NULLIF(trim(v_meta ->> 'access_request_id'), '') IS NOT NULL THEN
    BEGIN
      v_request_id := (v_meta ->> 'access_request_id')::uuid;
      UPDATE public.agent_access_requests
         SET status = 'completed',
             user_id = NEW.id,
             completed_at = now()
       WHERE id = v_request_id
         AND status = 'invited';
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_agent_invite_user_created ON auth.users;
CREATE TRIGGER on_agent_invite_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_agent_invite_user();
