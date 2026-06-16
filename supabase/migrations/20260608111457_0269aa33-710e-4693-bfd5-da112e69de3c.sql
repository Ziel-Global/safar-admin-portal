-- 1. Notify agent for ALL enforcement levels (not just L1) when an action is issued
CREATE OR REPLACE FUNCTION public.apply_enforcement_side_effects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_title text;
  v_body text;
BEGIN
  IF NEW.status = 'active' THEN
    IF NEW.level = 3 THEN
      UPDATE public.agents SET status = 'suspended' WHERE id = NEW.agent_id;
    ELSIF NEW.level = 4 THEN
      UPDATE public.agents SET status = 'banned' WHERE id = NEW.agent_id;
    END IF;

    -- Always inform the agent about the action taken against them
    SELECT user_id INTO v_user FROM public.agents WHERE id = NEW.agent_id;
    IF v_user IS NOT NULL THEN
      v_title := CASE NEW.level
        WHEN 1 THEN '⚠️ Warning from the Safar trust team'
        WHEN 2 THEN '⚠️ Listing demotion notice'
        WHEN 3 THEN '🚫 Your account has been suspended'
        WHEN 4 THEN '🚫 Your account has been permanently banned'
        ELSE 'Enforcement action on your account'
      END;
      v_body := NEW.reason
        || CASE
             WHEN NEW.level >= 3 AND NEW.expires_at IS NOT NULL
               THEN ' Your account will be automatically restored on '
                    || to_char(NEW.expires_at, 'DD Mon YYYY') || '.'
             WHEN NEW.level = 3
               THEN ' Your packages are hidden from search until this is resolved.'
             ELSE ''
           END;
      INSERT INTO public.notifications (user_id, type, title, body, link_url)
      VALUES (
        v_user,
        CASE WHEN NEW.level >= 3 THEN 'enforcement_action' ELSE 'enforcement_warning' END,
        v_title,
        v_body,
        '/agent/dashboard'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Auto-expire enforcement actions and notify the agent when restored
CREATE OR REPLACE FUNCTION public.expire_enforcement_actions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  r record;
  v_has_active_high boolean;
  v_user uuid;
BEGIN
  FOR r IN
    SELECT id, agent_id, level
    FROM public.enforcement_actions
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  LOOP
    UPDATE public.enforcement_actions
       SET status = 'expired'
     WHERE id = r.id;
    v_count := v_count + 1;

    IF r.level >= 3 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.enforcement_actions
        WHERE agent_id = r.agent_id
          AND status = 'active'
          AND level >= 3
          AND id <> r.id
      ) INTO v_has_active_high;

      IF NOT v_has_active_high THEN
        UPDATE public.agents
           SET status = 'active'
         WHERE id = r.agent_id
           AND status IN ('suspended', 'banned');

        SELECT user_id INTO v_user FROM public.agents WHERE id = r.agent_id;
        IF v_user IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, type, title, body, link_url)
          VALUES (
            v_user,
            'enforcement_action',
            '✅ Your account has been restored',
            'Your suspension period has ended. Your account is active again and your packages are visible to pilgrims.',
            '/agent/dashboard'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 3. Schedule daily auto-expiry of enforcement actions
SELECT cron.schedule(
  'expire-enforcement-actions-daily',
  '10 0 * * *',
  $$ SELECT public.expire_enforcement_actions(); $$
);