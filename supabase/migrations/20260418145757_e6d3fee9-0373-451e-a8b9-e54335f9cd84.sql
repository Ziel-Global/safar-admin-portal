-- ============================================================
-- 1. COMPLIANCE: badge expiry function
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_badge_expirations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer := 0;
  v_notified integer := 0;
  r record;
  v_days integer;
  v_user uuid;
  v_badge_name text;
BEGIN
  -- Auto-expire any verified badges past their expiry date
  UPDATE public.agent_badges
     SET status = 'expired',
         updated_at = now()
   WHERE status = 'verified'
     AND expires_at IS NOT NULL
     AND expires_at < CURRENT_DATE;
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Recalculate verification level for affected agents
  -- (the existing trigger on agent_badges handles this on update)

  -- Send threshold reminders for badges expiring in 90/60/30 days
  FOR r IN
    SELECT b.id, b.agent_id, b.expires_at, b.badge_type, a.user_id, bt.name AS badge_name
      FROM public.agent_badges b
      JOIN public.agents a ON a.id = b.agent_id
      LEFT JOIN public.badge_types bt ON bt.id = b.badge_type
     WHERE b.status = 'verified'
       AND b.expires_at IS NOT NULL
       AND b.expires_at >= CURRENT_DATE
       AND (b.expires_at - CURRENT_DATE) IN (30, 60, 90)
  LOOP
    v_days := (r.expires_at - CURRENT_DATE);
    v_user := r.user_id;
    v_badge_name := COALESCE(r.badge_name, r.badge_type);

    -- Avoid duplicate notification for the same badge+threshold within 24h
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.user_id = v_user
         AND n.type = 'badge_expiry_warning'
         AND n.body LIKE '%' || v_badge_name || '%' || v_days::text || '%'
         AND n.created_at > now() - interval '23 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_url)
      VALUES (
        v_user,
        'badge_expiry_warning',
        'Credential expiring soon',
        v_badge_name || ' expires in ' || v_days::text || ' days. Renew it to keep verification.',
        '/agent/dashboard'
      );
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', v_expired, 'notified', v_notified);
END;
$$;

-- ============================================================
-- 2. REFERRALS
-- ============================================================
CREATE TABLE public.referral_codes (
  agent_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  pilgrim_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'signed_up',
  credit_amount numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_agent ON public.referrals(agent_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Anyone can read codes (needed to resolve a referral link)
CREATE POLICY "Referral codes are public" ON public.referral_codes
  FOR SELECT USING (true);
CREATE POLICY "Agent owns their referral code (insert)" ON public.referral_codes
  FOR INSERT WITH CHECK (public.is_agent_owner(agent_id));
CREATE POLICY "Agent owns their referral code (update)" ON public.referral_codes
  FOR UPDATE USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents view their referrals" ON public.referrals
  FOR SELECT USING (public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Pilgrims can self-record a referral" ON public.referrals
  FOR INSERT WITH CHECK (pilgrim_id = auth.uid());
CREATE POLICY "Admins update referrals" ON public.referrals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Code generator
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, (floor(random() * length(v_chars))::int + 1), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Auto-create a code when a new agent row is inserted
CREATE OR REPLACE FUNCTION public.create_referral_code_for_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.referral_codes (agent_id, code)
  VALUES (NEW.id, public.generate_referral_code())
  ON CONFLICT (agent_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_referral_code
AFTER INSERT ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.create_referral_code_for_agent();

-- Backfill codes for existing agents
INSERT INTO public.referral_codes (agent_id, code)
SELECT a.id, public.generate_referral_code()
FROM public.agents a
WHERE NOT EXISTS (SELECT 1 FROM public.referral_codes rc WHERE rc.agent_id = a.id);

-- ============================================================
-- 3. AGENT ARTICLES (blog)
-- ============================================================
CREATE TABLE public.agent_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  body text NOT NULL DEFAULT '',
  featured_image text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  meta_title text,
  meta_description text,
  status text NOT NULL DEFAULT 'draft',
  is_pinned boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_articles_agent ON public.agent_articles(agent_id);
CREATE INDEX idx_agent_articles_status ON public.agent_articles(status);

ALTER TABLE public.agent_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published articles are public" ON public.agent_articles
  FOR SELECT USING (
    (status = 'published' AND public.is_active_agent(agent_id))
    OR public.is_agent_owner(agent_id)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Agents create their articles" ON public.agent_articles
  FOR INSERT WITH CHECK (public.is_agent_owner(agent_id));
CREATE POLICY "Agents update their articles" ON public.agent_articles
  FOR UPDATE USING (public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents delete their articles" ON public.agent_articles
  FOR DELETE USING (public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));

-- Slug + published_at + updated_at trigger
CREATE OR REPLACE FUNCTION public.set_agent_article_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter integer := 0;
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.slug IS NULL OR NEW.slug = ''))
     OR (TG_OP = 'UPDATE' AND NEW.title IS DISTINCT FROM OLD.title AND NEW.slug = OLD.slug) THEN
    base_slug := public.slugify(NEW.title);
    IF base_slug IS NULL OR base_slug = '' THEN base_slug := 'article'; END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.agent_articles WHERE slug = candidate AND id <> NEW.id) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  END IF;

  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status <> 'published') AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_articles_meta
BEFORE INSERT OR UPDATE ON public.agent_articles
FOR EACH ROW EXECUTE FUNCTION public.set_agent_article_meta();

-- ============================================================
-- 4. REGULATORY UPDATES
-- ============================================================
CREATE TABLE public.regulatory_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  severity text NOT NULL DEFAULT 'info',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_updates_published ON public.regulatory_updates(published_at DESC);
CREATE INDEX idx_reg_updates_countries ON public.regulatory_updates USING GIN(countries);

ALTER TABLE public.regulatory_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published regulatory updates are public" ON public.regulatory_updates
  FOR SELECT USING (published_at IS NOT NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage regulatory updates" ON public.regulatory_updates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));