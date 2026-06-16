-- ============================================================================
-- STEP 1: INDEXES
-- ============================================================================

-- Packages
CREATE INDEX IF NOT EXISTS idx_packages_search ON packages (status, departure_country, type);
CREATE INDEX IF NOT EXISTS idx_packages_price ON packages (base_price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_packages_agent ON packages (agent_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_packages_zone ON packages (hotel_zone) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_packages_dates ON packages (date_start, date_end) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_packages_slug ON packages (slug);

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_directory ON agents (status, country_code, avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents (slug) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents (user_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_agent ON reviews (agent_id, moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_moderation ON reviews (moderation_status) WHERE moderation_status = 'pending';

-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_agent_status ON leads (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_agent_created ON leads (agent_id, created_at DESC);

-- RFQs
CREATE INDEX IF NOT EXISTS idx_rfqs_pilgrim ON rfqs (pilgrim_id, status);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_agent ON rfq_agent_matches (agent_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_rfq ON rfq_agent_matches (rfq_id);

-- Quotes
CREATE INDEX IF NOT EXISTS idx_quotes_rfq ON quotes (rfq_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_agent ON quotes (agent_id);

-- Watchlist & price alerts
CREATE INDEX IF NOT EXISTS idx_watchlist_pilgrim ON watchlist (pilgrim_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_package ON watchlist (package_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts (is_active, package_id) WHERE is_active = true;

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

-- Package media / tiers / availability
CREATE INDEX IF NOT EXISTS idx_package_media_package ON package_media (package_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_package_tiers_package ON package_tiers (package_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_availability_package_date ON package_availability (package_id, date);

-- Featured campaigns
CREATE INDEX IF NOT EXISTS idx_featured_active ON featured_campaigns (status, start_date, end_date) WHERE status = 'active';

-- Agent badges
CREATE INDEX IF NOT EXISTS idx_agent_badges_agent ON agent_badges (agent_id, status);

-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_pilgrim ON bookings (pilgrim_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON bookings (agent_id, status);

-- SEO pages
CREATE INDEX IF NOT EXISTS idx_seo_pages_slug ON seo_pages (slug) WHERE status = 'active';

-- Search logs
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs (created_at DESC);

-- Lead notes
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes (lead_id, created_at DESC);

-- CMS
CREATE INDEX IF NOT EXISTS idx_cms_slug ON cms_content (slug, status) WHERE status = 'published';

-- Fraud reports
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports (status, severity);

-- Enforcement
CREATE INDEX IF NOT EXISTS idx_enforcement_agent ON enforcement_actions (agent_id, status);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_rfq ON messages (rfq_id, created_at DESC);

-- NOTE: idx_disputes_status skipped — no `disputes` table exists in this schema.

-- ============================================================================
-- STEP 2: RLS OPTIMIZATION
-- ============================================================================

-- 2a. Denormalize agent active status onto packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_agent_active boolean NOT NULL DEFAULT true;

-- Backfill from current agent status
UPDATE packages p
   SET is_agent_active = (a.status = 'active')
  FROM agents a
 WHERE a.id = p.agent_id
   AND p.is_agent_active IS DISTINCT FROM (a.status = 'active');

-- Index for the new RLS check
CREATE INDEX IF NOT EXISTS idx_packages_active_agent_active
  ON packages (status, is_agent_active)
  WHERE status = 'active' AND is_agent_active = true;

-- Trigger: keep packages.is_agent_active in sync when agents.status changes
CREATE OR REPLACE FUNCTION public.sync_packages_agent_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.packages
       SET is_agent_active = (NEW.status = 'active')
     WHERE agent_id = NEW.id
       AND is_agent_active IS DISTINCT FROM (NEW.status = 'active');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_packages_agent_active ON public.agents;
CREATE TRIGGER trg_sync_packages_agent_active
  AFTER UPDATE OF status ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_packages_agent_active();

-- 2b. Replace packages public SELECT policy with indexed-column check
DROP POLICY IF EXISTS "Active packages are viewable by everyone" ON public.packages;

CREATE POLICY "Active packages are viewable by everyone"
ON public.packages
FOR SELECT
USING (
  (status = 'active' AND is_agent_active = true)
  OR is_package_owner(agent_id)
  OR has_role(auth.uid(), 'admin')
);

-- 2c. Cached helper to resolve current user's agent_id once per transaction
CREATE OR REPLACE FUNCTION public.get_agent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1
$$;

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================
-- Run these in the SQL editor after the migration is applied. Each should show
-- Index Scan or Bitmap Index Scan, not Seq Scan.
--
-- EXPLAIN ANALYZE
-- SELECT id, title, slug, thumbnail_url, base_price, currency, hotel_name,
--        hotel_zone, hotel_stars, distance_to_haram_m
--   FROM packages
--  WHERE status = 'active' AND is_agent_active = true
--    AND departure_country = 'GB' AND type = 'umrah'
--  ORDER BY base_price ASC LIMIT 20;
--
-- EXPLAIN ANALYZE
-- SELECT id, business_name, slug, logo_url, country_code, avg_rating,
--        total_reviews, avg_response_mins, verification_level, specialisations
--   FROM agents
--  WHERE status = 'active' AND country_code = 'GB'
--  ORDER BY avg_rating DESC LIMIT 20;
--
-- EXPLAIN ANALYZE
-- SELECT id, pilgrim_name, trip_type, departure_date, group_size, budget_range,
--        status, score, created_at
--   FROM leads
--  WHERE agent_id = '00000000-0000-0000-0000-000000000000'
--  ORDER BY created_at DESC LIMIT 50;