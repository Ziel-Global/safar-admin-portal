DROP POLICY IF EXISTS "Anyone can record a metric event" ON public.featured_metrics;

CREATE POLICY "Record metric for active campaigns"
  ON public.featured_metrics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.featured_campaigns fc
      WHERE fc.id = featured_metrics.campaign_id
        AND fc.status = 'active'
        AND fc.start_date <= CURRENT_DATE
        AND fc.end_date   >= CURRENT_DATE
    )
  );