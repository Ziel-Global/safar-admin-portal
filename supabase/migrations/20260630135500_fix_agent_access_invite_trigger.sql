-- Fix invite flow: avoid auth.users trigger side effects causing
-- "Database error saving new user" on inviteUserByEmail.
-- We only need to mark access requests as completed after the profile exists.

DROP TRIGGER IF EXISTS on_agent_invite_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_agent_invite_user();

CREATE OR REPLACE FUNCTION public.complete_agent_access_request_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_request_id uuid;
BEGIN
  IF NEW.role <> 'agent' THEN
    RETURN NEW;
  END IF;

  SELECT raw_user_meta_data INTO v_meta
  FROM auth.users
  WHERE id = NEW.id;

  IF v_meta IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_meta ->> 'agent_invite', '') <> 'true' THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS on_profile_created_complete_agent_access_request ON public.profiles;
CREATE TRIGGER on_profile_created_complete_agent_access_request
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.complete_agent_access_request_on_profile_insert();
