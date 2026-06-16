CREATE OR REPLACE FUNCTION public.agent_analytics_daily(
  _agent_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  date date,
  views integer,
  enquiries integer,
  quotes_sent integer,
  bookings integer,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(_from, _to, interval '1 day')::date AS day
  )
  SELECT
    d.day AS date,
    COALESCE(v.views, 0)::integer AS views,
    COALESCE(l.enquiries, 0)::integer AS enquiries,
    COALESCE(q.quotes_sent, 0)::integer AS quotes_sent,
    COALESCE(b.bookings, 0)::integer AS bookings,
    COALESCE(b.revenue, 0)::numeric AS revenue
  FROM days d
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS views
    FROM public.page_views pv
    WHERE pv.created_at >= d.day
      AND pv.created_at < (d.day + 1)
      AND (
        (pv.page_type = 'agent' AND pv.entity_id = _agent_id)
        OR (
          pv.page_type = 'package'
          AND EXISTS (
            SELECT 1
            FROM public.packages p
            WHERE p.id = pv.entity_id
              AND p.agent_id = _agent_id
          )
        )
      )
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS enquiries
    FROM public.leads lead
    WHERE lead.agent_id = _agent_id
      AND lead.created_at >= d.day
      AND lead.created_at < (d.day + 1)
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS quotes_sent
    FROM public.quotes quote
    WHERE quote.agent_id = _agent_id
      AND quote.created_at >= d.day
      AND quote.created_at < (d.day + 1)
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS bookings,
           COALESCE(SUM(booking.total_amount), 0)::numeric AS revenue
    FROM public.bookings booking
    WHERE booking.agent_id = _agent_id
      AND booking.created_at >= d.day
      AND booking.created_at < (d.day + 1)
  ) b ON true
  WHERE _from <= _to
    AND (public.is_agent_owner(_agent_id) OR public.has_role(auth.uid(), 'admin'))
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.agent_revenue_by_package(
  _agent_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  package_id uuid,
  title text,
  revenue numeric,
  bookings integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.package_id,
    COALESCE(p.title, 'Untitled') AS title,
    COALESCE(SUM(b.total_amount), 0)::numeric AS revenue,
    COUNT(*)::integer AS bookings
  FROM public.bookings b
  LEFT JOIN public.packages p ON p.id = b.package_id
  WHERE b.agent_id = _agent_id
    AND b.package_id IS NOT NULL
    AND b.created_at >= _from
    AND b.created_at < (_to + 1)
    AND (public.is_agent_owner(_agent_id) OR public.has_role(auth.uid(), 'admin'))
  GROUP BY b.package_id, p.title
  ORDER BY revenue DESC, bookings DESC
  LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.agent_lead_sources(
  _agent_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  source text,
  count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(l.source, ''), 'unknown') AS source,
    COUNT(*)::integer AS count
  FROM public.leads l
  WHERE l.agent_id = _agent_id
    AND l.created_at >= _from
    AND l.created_at < (_to + 1)
    AND (public.is_agent_owner(_agent_id) OR public.has_role(auth.uid(), 'admin'))
  GROUP BY COALESCE(NULLIF(l.source, ''), 'unknown')
  ORDER BY count DESC, source ASC;
$$;

CREATE OR REPLACE FUNCTION public.featured_metrics_for_campaigns(_campaign_ids uuid[])
RETURNS TABLE (
  campaign_id uuid,
  impressions integer,
  clicks integer,
  rfqs integer,
  cost numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fm.campaign_id,
    COALESCE(SUM(fm.impressions), 0)::integer AS impressions,
    COALESCE(SUM(fm.clicks), 0)::integer AS clicks,
    COALESCE(SUM(fm.rfqs), 0)::integer AS rfqs,
    COALESCE(SUM(fm.cost), 0)::numeric AS cost
  FROM public.featured_metrics fm
  JOIN public.featured_campaigns fc ON fc.id = fm.campaign_id
  WHERE fm.campaign_id = ANY(_campaign_ids)
    AND (public.is_agent_owner(fc.agent_id) OR public.has_role(auth.uid(), 'admin'))
  GROUP BY fm.campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.agent_analytics_daily(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_revenue_by_package(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_lead_sources(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.featured_metrics_for_campaigns(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_analytics_daily(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_revenue_by_package(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_lead_sources(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.featured_metrics_for_campaigns(uuid[]) TO service_role;