
-- ============================================================
-- 1. FRAUD REPORTS
-- ============================================================
CREATE TABLE public.fraud_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  package_id uuid,
  report_type text NOT NULL CHECK (report_type IN ('unlicensed','misleading','bait_switch','harassment','other')),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','investigating','resolved','dismissed')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_fraud_reports_status ON public.fraud_reports(status);
CREATE INDEX idx_fraud_reports_severity ON public.fraud_reports(severity);
CREATE INDEX idx_fraud_reports_agent ON public.fraud_reports(agent_id);

ALTER TABLE public.fraud_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can submit reports"
  ON public.fraud_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporters can view their own reports"
  ON public.fraud_reports FOR SELECT
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins update reports"
  ON public.fraud_reports FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete reports"
  ON public.fraud_reports FOR DELETE
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 2. ENFORCEMENT ACTIONS
-- ============================================================
CREATE TABLE public.enforcement_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  issued_by uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_enforcement_agent ON public.enforcement_actions(agent_id);
CREATE INDEX idx_enforcement_status ON public.enforcement_actions(status);

ALTER TABLE public.enforcement_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage enforcement"
  ON public.enforcement_actions FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Agents view their own enforcement history"
  ON public.enforcement_actions FOR SELECT
  USING (public.is_agent_owner(agent_id));

-- Apply side-effects of enforcement on the agent record
CREATE OR REPLACE FUNCTION public.apply_enforcement_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF NEW.level = 3 THEN
      UPDATE public.agents SET status = 'suspended' WHERE id = NEW.agent_id;
    ELSIF NEW.level = 4 THEN
      UPDATE public.agents SET status = 'banned' WHERE id = NEW.agent_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforcement_side_effects
  AFTER INSERT ON public.enforcement_actions
  FOR EACH ROW EXECUTE FUNCTION public.apply_enforcement_side_effects();

-- ============================================================
-- 3. ADMIN AUDIT LOG
-- ============================================================
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_admin ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.admin_audit_log(entity_type, entity_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins insert audit log entries"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

-- ============================================================
-- 4. SUSPENSION SIDE-EFFECTS — hide content from suspended/banned agents
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_agent(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.agents WHERE id = _agent_id AND status = 'active')
$$;

-- Update packages visibility: hide if owning agent is suspended/banned
DROP POLICY IF EXISTS "Active packages are viewable by everyone" ON public.packages;
CREATE POLICY "Active packages are viewable by everyone"
  ON public.packages FOR SELECT
  USING (
    (status = 'active' AND public.is_active_agent(agent_id))
    OR public.is_package_owner(agent_id)
    OR public.has_role(auth.uid(),'admin')
  );

-- Update package_tiers visibility
DROP POLICY IF EXISTS "Active tiers are public" ON public.package_tiers;
CREATE POLICY "Active tiers are public"
  ON public.package_tiers FOR SELECT
  USING (
    (status = 'active' AND EXISTS (
      SELECT 1 FROM public.packages p
      JOIN public.agents a ON a.id = p.agent_id
      WHERE p.id = package_tiers.package_id AND a.status = 'active'
    ))
    OR public.is_media_package_owner(package_id)
    OR public.has_role(auth.uid(),'admin')
  );

-- Update package_media visibility
DROP POLICY IF EXISTS "Approved media is viewable by everyone" ON public.package_media;
CREATE POLICY "Approved media is viewable by everyone"
  ON public.package_media FOR SELECT
  USING (
    (moderation_status = 'approved' AND EXISTS (
      SELECT 1 FROM public.packages p
      JOIN public.agents a ON a.id = p.agent_id
      WHERE p.id = package_media.package_id AND a.status = 'active'
    ))
    OR public.is_media_package_owner(package_id)
    OR public.has_role(auth.uid(),'admin')
  );

-- Update agents visibility: hide banned agents from the public, allow self/admin
DROP POLICY IF EXISTS "Active agents are viewable by everyone" ON public.agents;
CREATE POLICY "Active agents are viewable by everyone"
  ON public.agents FOR SELECT
  USING (
    status IN ('active','suspended')  -- suspended profile remains visible (read-only) but their packages disappear
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(),'admin')
  );
