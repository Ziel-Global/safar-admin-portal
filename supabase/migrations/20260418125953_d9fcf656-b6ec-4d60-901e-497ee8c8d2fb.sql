-- =========================================================
-- page_views: raw event log
-- =========================================================
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL CHECK (page_type IN ('package','agent')),
  entity_id uuid NOT NULL,
  viewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_entity ON public.page_views (page_type, entity_id, created_at DESC);
CREATE INDEX idx_page_views_created ON public.page_views (created_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a page view"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins read page views"
  ON public.page_views FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents read views of their own entities"
  ON public.page_views FOR SELECT
  USING (
    (page_type = 'agent' AND public.is_agent_owner(entity_id))
    OR (page_type = 'package' AND public.is_media_package_owner(entity_id))
  );

-- =========================================================
-- agent_metrics: daily aggregated rollups
-- =========================================================
CREATE TABLE public.agent_metrics (
  agent_id uuid NOT NULL,
  date date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  enquiries integer NOT NULL DEFAULT 0,
  quotes_sent integer NOT NULL DEFAULT 0,
  bookings integer NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, date)
);

CREATE INDEX idx_agent_metrics_date ON public.agent_metrics (date DESC);

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read their own metrics"
  ON public.agent_metrics FOR SELECT
  USING (public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage agent metrics"
  ON public.agent_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- aggregate_agent_metrics(target_date)
-- =========================================================
CREATE OR REPLACE FUNCTION public.aggregate_agent_metrics(target_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.agent_metrics (agent_id, date, views, enquiries, quotes_sent, bookings, revenue, updated_at)
  SELECT
    a.id AS agent_id,
    target_date AS date,
    -- Views = profile views + views of any of the agent's packages
    (
      SELECT COUNT(*) FROM public.page_views pv
      WHERE pv.created_at >= target_date
        AND pv.created_at < (target_date + 1)
        AND (
          (pv.page_type = 'agent' AND pv.entity_id = a.id)
          OR (pv.page_type = 'package' AND pv.entity_id IN (SELECT id FROM public.packages WHERE agent_id = a.id))
        )
    ) AS views,
    -- Enquiries = leads created that day
    (
      SELECT COUNT(*) FROM public.leads l
      WHERE l.agent_id = a.id
        AND l.created_at >= target_date AND l.created_at < (target_date + 1)
    ) AS enquiries,
    -- Quotes sent that day
    (
      SELECT COUNT(*) FROM public.quotes q
      WHERE q.agent_id = a.id
        AND q.created_at >= target_date AND q.created_at < (target_date + 1)
    ) AS quotes_sent,
    -- Bookings created that day
    (
      SELECT COUNT(*) FROM public.bookings b
      WHERE b.agent_id = a.id
        AND b.created_at >= target_date AND b.created_at < (target_date + 1)
    ) AS bookings,
    -- Revenue from those bookings
    (
      SELECT COALESCE(SUM(b.total_amount), 0) FROM public.bookings b
      WHERE b.agent_id = a.id
        AND b.created_at >= target_date AND b.created_at < (target_date + 1)
    ) AS revenue,
    now()
  FROM public.agents a
  WHERE a.status = 'active'
  ON CONFLICT (agent_id, date) DO UPDATE
    SET views       = EXCLUDED.views,
        enquiries   = EXCLUDED.enquiries,
        quotes_sent = EXCLUDED.quotes_sent,
        bookings    = EXCLUDED.bookings,
        revenue     = EXCLUDED.revenue,
        updated_at  = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =========================================================
-- Helper: market benchmark (avg conversion %) by country
-- conversion = quotes_sent / NULLIF(enquiries,0)
-- =========================================================
CREATE OR REPLACE FUNCTION public.market_conversion_benchmark(_country_code text, _from date, _to date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(
    AVG(
      CASE WHEN m.enquiries > 0 THEN (m.quotes_sent::numeric / m.enquiries::numeric) * 100 ELSE NULL END
    )::numeric, 1)
  FROM public.agent_metrics m
  JOIN public.agents a ON a.id = m.agent_id
  WHERE m.date BETWEEN _from AND _to
    AND (_country_code IS NULL OR a.country_code = _country_code);
$$;