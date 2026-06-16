
-- =========================================
-- PROFILES TABLE
-- =========================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'pilgrim' CHECK (role IN ('pilgrim', 'agent', 'admin')),
  full_name text,
  country_code text,
  preferred_locale text NOT NULL DEFAULT 'en',
  preferred_currency text NOT NULL DEFAULT 'GBP',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- ROLE HELPER (security definer to avoid RLS recursion)
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role
  )
$$;

-- =========================================
-- PROFILES POLICIES
-- =========================================
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, country_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'pilgrim'),
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'country_code'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- AGENTS TABLE
-- =========================================
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  cover_image_url text,
  city text,
  country_code text,
  bio text,
  specialisations text[],
  years_active smallint NOT NULL DEFAULT 0,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  total_reviews integer NOT NULL DEFAULT 0,
  avg_response_mins integer,
  trust_score smallint NOT NULL DEFAULT 0,
  verification_level text NOT NULL DEFAULT 'bronze' CHECK (verification_level IN ('bronze', 'silver', 'gold', 'platinum')),
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_slug ON public.agents(slug);
CREATE INDEX idx_agents_status ON public.agents(status);

-- =========================================
-- AGENTS POLICIES
-- =========================================
CREATE POLICY "Active agents are viewable by everyone"
  ON public.agents FOR SELECT
  USING (status = 'active' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own agent record"
  ON public.agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Agents can update their own record"
  ON public.agents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any agent"
  ON public.agents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- SLUG GENERATION
-- =========================================
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM
    regexp_replace(
      regexp_replace(lower(_input), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.set_agent_slug()
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
  IF (TG_OP = 'INSERT' AND NEW.slug IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.business_name IS DISTINCT FROM OLD.business_name AND NEW.slug = OLD.slug) THEN
    base_slug := public.slugify(NEW.business_name);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'agent';
    END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.agents WHERE slug = candidate AND id <> NEW.id) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_set_slug
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_slug();

-- =========================================
-- UPDATED_AT TRIGGER
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_touch_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- AUTO-CREATE AGENT RECORD WHEN ROLE IS AGENT
-- =========================================
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
    INSERT INTO public.agents (user_id, business_name, city, country_code)
    VALUES (NEW.id, v_business_name, v_city, NEW.country_code)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_agent
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_agent_profile();
