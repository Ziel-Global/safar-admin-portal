
-- ============================================================
-- seo_pages table
-- ============================================================
CREATE TABLE public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  trip_type text NOT NULL CHECK (trip_type IN ('hajj','umrah')),
  locale text NOT NULL DEFAULT 'en',
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  meta_description text NOT NULL,
  hero_image_url text,
  price_min numeric(10,2),
  price_max numeric(10,2),
  agent_count integer NOT NULL DEFAULT 0,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, trip_type, locale)
);

CREATE INDEX idx_seo_pages_status ON public.seo_pages(status);
CREATE INDEX idx_seo_pages_city ON public.seo_pages(city);

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active SEO pages are public"
  ON public.seo_pages FOR SELECT
  USING (status = 'active' OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage SEO pages"
  ON public.seo_pages FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER seo_pages_touch_updated_at
  BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- cms_content table
-- ============================================================
CREATE TABLE public.cms_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'page' CHECK (type IN ('page','post','guide')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  locale text NOT NULL DEFAULT 'en',
  seo_title text,
  seo_description text,
  author_id uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cms_content_status ON public.cms_content(status);
CREATE INDEX idx_cms_content_type ON public.cms_content(type);

ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published content is public"
  ON public.cms_content FOR SELECT
  USING (status = 'published' OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage cms content"
  ON public.cms_content FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER cms_content_touch_updated_at
  BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- recompute_seo_pages() RPC
-- Refreshes price_min, price_max, agent_count for all SEO pages
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_seo_pages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_min numeric;
  v_max numeric;
  v_agents integer;
BEGIN
  FOR r IN SELECT id, city, trip_type FROM public.seo_pages LOOP
    SELECT
      MIN(p.base_price),
      MAX(p.base_price),
      COUNT(DISTINCT p.agent_id)
      INTO v_min, v_max, v_agents
    FROM public.packages p
    JOIN public.agents a ON a.id = p.agent_id
    WHERE p.status = 'active'
      AND a.status = 'active'
      AND lower(p.departure_city) = lower(r.city)
      AND p.type = r.trip_type;

    UPDATE public.seo_pages
       SET price_min = v_min,
           price_max = v_max,
           agent_count = COALESCE(v_agents, 0),
           updated_at = now()
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- Seed SEO pages: 30 cities × 2 trip types = 60 rows
-- ============================================================
WITH cities(city) AS (
  VALUES
    ('London'),('Birmingham'),('Manchester'),
    ('Karachi'),('Lahore'),('Islamabad'),
    ('Jakarta'),('Surabaya'),
    ('Lagos'),('Abuja'),
    ('Dhaka'),('Istanbul'),('Cairo'),('Riyadh'),('Jeddah'),
    ('Dubai'),('Kuala Lumpur'),('Paris'),
    ('New York'),('Chicago'),('Houston'),
    ('Toronto'),('Sydney'),
    ('Johannesburg'),('Nairobi'),('Casablanca'),
    ('Delhi'),('Mumbai'),('Colombo'),('Doha')
), types(trip_type, label, year) AS (
  VALUES ('umrah','Umrah','2026'), ('hajj','Hajj','2026')
)
INSERT INTO public.seo_pages (city, trip_type, locale, slug, title, meta_description, faq, status)
SELECT
  c.city,
  t.trip_type,
  'en',
  lower(regexp_replace(t.trip_type || '-from-' || c.city, '[^a-zA-Z0-9]+', '-', 'g')),
  t.label || ' Packages from ' || c.city || ' ' || t.year || ' | SafarMarket',
  'Compare verified ' || t.label || ' packages from ' || c.city ||
    ' for ' || t.year || '. Trusted agents, transparent pricing, real reviews.',
  jsonb_build_array(
    jsonb_build_object(
      'question', 'How much does ' || t.label || ' from ' || c.city || ' cost?',
      'answer',   'Prices vary by hotel category, distance to the Haram and travel season. Most ' || t.label || ' packages from ' || c.city || ' fall between budget (3★) and premium (5★) tiers — see live pricing from verified agents above.'
    ),
    jsonb_build_object(
      'question', 'Which agents serve the ' || c.city || ' to Saudi Arabia route?',
      'answer',   'SafarMarket lists verified agents who run regular ' || t.label || ' departures from ' || c.city || '. All agents are vetted for licensing (ATOL, Maqam, Ministry of Hajj) and reviewed by past pilgrims.'
    ),
    jsonb_build_object(
      'question', 'When is the best time to travel?',
      'answer',   CASE WHEN t.trip_type = 'hajj'
                       THEN 'Hajj happens once a year on fixed Islamic calendar dates (8–13 Dhul Hijjah). Book at least 6–9 months ahead — quotas from ' || c.city || ' fill quickly.'
                       ELSE 'Umrah can be performed year-round except during Hajj season. Off-peak months (after Ramadan, before Hajj) usually offer the best prices and quieter Haram.' END
    ),
    jsonb_build_object(
      'question', 'What is included in a typical package?',
      'answer',   'Most packages from ' || c.city || ' include return flights, visa processing, hotel accommodation in Makkah and Madinah, ground transport between holy sites, and Ziyarat tours. Always confirm visa, meals and transport details with the agent before booking.'
    ),
    jsonb_build_object(
      'question', 'How do I compare packages safely?',
      'answer',   'Use our compare tool to put up to 3 packages side-by-side, check agent verification badges, read verified reviews, and request a no-obligation quote (RFQ) to get tailored offers.'
    )
  ),
  'active'
FROM cities c CROSS JOIN types t;

-- Run initial recompute to populate price/agent columns
SELECT public.recompute_seo_pages();
