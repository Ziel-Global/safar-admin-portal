-- Prevent agent invite creation from failing due to downstream agent-row insert errors.
-- If agent bootstrap insert fails for any reason, we don't block auth user creation.

CREATE OR REPLACE FUNCTION public.handle_new_agent_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  v_business_name text;
  v_city text;
BEGIN
  IF NEW.role = 'agent' THEN
    SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = NEW.id;
    v_business_name := COALESCE(meta ->> 'business_name', COALESCE(NEW.full_name, 'New Agency'));
    v_city := meta ->> 'city';

    BEGIN
      INSERT INTO public.agents (user_id, business_name, city, country_code)
      VALUES (NEW.id, v_business_name, v_city, NEW.country_code)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Never block signup/invite pipeline because of agent bootstrap issues.
      RAISE WARNING 'handle_new_agent_profile skipped for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
