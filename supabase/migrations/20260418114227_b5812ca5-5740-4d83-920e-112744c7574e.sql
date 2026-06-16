-- =========================================
-- 1. AGENT AVAILABILITY
-- =========================================
CREATE TABLE public.agent_availability (
  agent_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online','away')),
  auto_reply text,
  return_date timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability is public"
  ON public.agent_availability FOR SELECT
  USING (true);

CREATE POLICY "Agents manage their own availability (insert)"
  ON public.agent_availability FOR INSERT
  WITH CHECK (public.is_agent_owner(agent_id));

CREATE POLICY "Agents manage their own availability (update)"
  ON public.agent_availability FOR UPDATE
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents can delete their availability"
  ON public.agent_availability FOR DELETE
  USING (public.is_agent_owner(agent_id));

CREATE TRIGGER trg_availability_touch
  BEFORE UPDATE ON public.agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-reply note when an away agent gets a new lead
CREATE OR REPLACE FUNCTION public.auto_reply_on_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_reply text;
  v_return timestamptz;
  v_agent_user uuid;
BEGIN
  SELECT status, auto_reply, return_date
    INTO v_status, v_reply, v_return
  FROM public.agent_availability
  WHERE agent_id = NEW.agent_id;

  IF v_status = 'away' AND v_reply IS NOT NULL THEN
    SELECT user_id INTO v_agent_user FROM public.agents WHERE id = NEW.agent_id;
    IF v_agent_user IS NOT NULL THEN
      INSERT INTO public.lead_notes (lead_id, user_id, note)
      VALUES (
        NEW.id,
        v_agent_user,
        '[Auto-reply — agent away' ||
        CASE WHEN v_return IS NOT NULL
          THEN ', back ' || to_char(v_return, 'DD Mon YYYY')
          ELSE ''
        END ||
        ']: ' || v_reply
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reply_new_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_reply_on_new_lead();

-- =========================================
-- 2. RESPONSE TIME COMPUTATION
-- =========================================
CREATE OR REPLACE FUNCTION public.compute_agent_response_time(agent_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg integer;
BEGIN
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60))::integer
    INTO v_avg
  FROM public.leads
  WHERE agent_id = agent_uuid
    AND first_response_at IS NOT NULL
    AND created_at >= now() - interval '30 days';

  UPDATE public.agents SET avg_response_mins = v_avg WHERE id = agent_uuid;
  RETURN v_avg;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_response_time_on_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_response_at IS DISTINCT FROM OLD.first_response_at AND NEW.first_response_at IS NOT NULL THEN
    PERFORM public.compute_agent_response_time(NEW.agent_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_response_time
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.refresh_response_time_on_lead();

-- =========================================
-- 3. TRUST SCORES
-- =========================================
CREATE TABLE public.trust_scores (
  agent_id uuid PRIMARY KEY,
  total_score smallint NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  tips text[] NOT NULL DEFAULT ARRAY[]::text[],
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trust scores are public"
  ON public.trust_scores FOR SELECT
  USING (true);

CREATE POLICY "Admins manage trust scores"
  ON public.trust_scores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.compute_trust_score(agent_uuid uuid)
RETURNS smallint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating numeric;
  v_avg_response integer;
  v_years smallint;
  v_verified_count integer;
  v_reviews_f numeric;
  v_response_f numeric;
  v_years_f numeric;
  v_verification_f numeric;
  v_complaints_f numeric := 20;
  v_total smallint;
  v_factors jsonb;
  v_tips text[] := ARRAY[]::text[];
  v_min_factor text;
  v_min_value numeric;
BEGIN
  SELECT avg_rating, avg_response_mins, years_active
    INTO v_avg_rating, v_avg_response, v_years
  FROM public.agents WHERE id = agent_uuid;

  SELECT COUNT(*) INTO v_verified_count
  FROM public.agent_badges
  WHERE agent_id = agent_uuid AND status = 'verified';

  v_reviews_f := LEAST(COALESCE(v_avg_rating,0) / 5.0, 1) * 20;
  v_response_f := CASE
    WHEN v_avg_response IS NULL THEN 0
    ELSE GREATEST(0, (1 - v_avg_response::numeric / 1440)) * 20
  END;
  v_years_f := LEAST(COALESCE(v_years,0)::numeric / 10.0, 1) * 20;
  v_verification_f := (LEAST(v_verified_count, 4)::numeric / 4.0) * 20;

  v_total := ROUND(v_reviews_f + v_response_f + v_years_f + v_verification_f + v_complaints_f);

  v_factors := jsonb_build_object(
    'reviews', ROUND(v_reviews_f, 2),
    'response', ROUND(v_response_f, 2),
    'years', ROUND(v_years_f, 2),
    'verification', ROUND(v_verification_f, 2),
    'complaints', ROUND(v_complaints_f, 2)
  );

  -- Generate tips for lowest scoring factor (excluding placeholder complaints)
  v_min_factor := 'reviews';
  v_min_value := v_reviews_f;
  IF v_response_f < v_min_value THEN v_min_factor := 'response'; v_min_value := v_response_f; END IF;
  IF v_years_f < v_min_value THEN v_min_factor := 'years'; v_min_value := v_years_f; END IF;
  IF v_verification_f < v_min_value THEN v_min_factor := 'verification'; v_min_value := v_verification_f; END IF;

  IF v_min_factor = 'reviews' THEN
    v_tips := ARRAY['Encourage past customers to leave reviews — your rating drives the largest trust gain.'];
  ELSIF v_min_factor = 'response' THEN
    v_tips := ARRAY['Reply to new leads within 2 hours to boost your response score.'];
  ELSIF v_min_factor = 'years' THEN
    v_tips := ARRAY['Years active grows automatically — keep your account in good standing.'];
  ELSIF v_min_factor = 'verification' THEN
    v_tips := ARRAY['Upload more credentials (ATOL, Maqam, Ministry, IATA) to reach Platinum verification.'];
  END IF;

  INSERT INTO public.trust_scores (agent_id, total_score, factors, tips, computed_at)
  VALUES (agent_uuid, v_total, v_factors, v_tips, now())
  ON CONFLICT (agent_id) DO UPDATE
    SET total_score = EXCLUDED.total_score,
        factors = EXCLUDED.factors,
        tips = EXCLUDED.tips,
        computed_at = EXCLUDED.computed_at;

  UPDATE public.agents SET trust_score = v_total WHERE id = agent_uuid;
  RETURN v_total;
END;
$$;

-- Auto-recompute when key inputs change
CREATE OR REPLACE FUNCTION public.recompute_trust_score_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid;
BEGIN
  v_agent := COALESCE(NEW.agent_id, OLD.agent_id);
  IF v_agent IS NOT NULL THEN
    PERFORM public.compute_trust_score(v_agent);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_trust_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_trust_score_trigger();

CREATE TRIGGER trg_trust_on_badge
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_badges
  FOR EACH ROW EXECUTE FUNCTION public.recompute_trust_score_trigger();