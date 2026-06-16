-- Subscription plans (publicly readable catalogue)
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_limit integer,
  sort_order smallint NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscription plans are public"
  ON public.subscription_plans FOR SELECT USING (true);

CREATE POLICY "Admins manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER subscription_plans_touch
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed plans
INSERT INTO public.subscription_plans (id, name, tier, price_monthly, lead_limit, sort_order, is_custom, features) VALUES
  ('free', 'Free', 'free', 0, 5, 1, false,
   '["Basic agency listing","Up to 5 leads per month","Standard search visibility"]'::jsonb),
  ('standard', 'Standard', 'standard', 49, NULL, 2, false,
   '["Everything in Free","Unlimited leads","Performance analytics","Media gallery","Package templates"]'::jsonb),
  ('professional', 'Professional', 'professional', 149, NULL, 3, false,
   '["Everything in Standard","Promotional campaigns","Featured listings","Priority lead delivery","Review solicitation tools"]'::jsonb),
  ('premium', 'Premium', 'premium', 349, NULL, 4, false,
   '["Everything in Professional","Competitor benchmarks","Homepage spotlight","Sponsored search results","Dedicated account manager"]'::jsonb),
  ('enterprise', 'Enterprise', 'enterprise', 0, NULL, 5, true,
   '["Everything in Premium","Multi-location support","API access","Custom integrations","SLA & priority support"]'::jsonb);

-- Featured (sponsored) campaigns
CREATE TABLE public.featured_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  package_id uuid NOT NULL,
  name text,
  target_markets text[] NOT NULL DEFAULT ARRAY[]::text[],
  budget numeric(10,2) NOT NULL DEFAULT 0,
  bid_amount numeric(10,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_campaigns_agent ON public.featured_campaigns(agent_id);
CREATE INDEX idx_featured_campaigns_package ON public.featured_campaigns(package_id);
CREATE INDEX idx_featured_campaigns_status_dates ON public.featured_campaigns(status, start_date, end_date);

ALTER TABLE public.featured_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active featured campaigns are public"
  ON public.featured_campaigns FOR SELECT
  USING (status = 'active' OR public.is_agent_owner(agent_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents create featured campaigns"
  ON public.featured_campaigns FOR INSERT
  WITH CHECK (public.is_agent_owner(agent_id));

CREATE POLICY "Agents update featured campaigns"
  ON public.featured_campaigns FOR UPDATE
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Agents delete featured campaigns"
  ON public.featured_campaigns FOR DELETE
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins manage featured campaigns"
  ON public.featured_campaigns FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER featured_campaigns_touch
  BEFORE UPDATE ON public.featured_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Per-day metrics for featured campaigns
CREATE TABLE public.featured_metrics (
  campaign_id uuid NOT NULL,
  date date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  rfqs integer NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, date)
);

CREATE INDEX idx_featured_metrics_date ON public.featured_metrics(date);

ALTER TABLE public.featured_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read their featured metrics"
  ON public.featured_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.featured_campaigns fc
      WHERE fc.id = featured_metrics.campaign_id
        AND (public.is_agent_owner(fc.agent_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Anyone can record a metric event"
  ON public.featured_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins manage featured metrics"
  ON public.featured_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));