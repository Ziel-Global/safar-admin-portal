ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS session_revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_revoked_at timestamptz := now();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF auth.uid() IS DISTINCT FROM _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to revoke sessions for this user';
  END IF;

  UPDATE public.profiles
     SET session_revoked_at = v_revoked_at
   WHERE id = _user_id;

  RETURN v_revoked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;