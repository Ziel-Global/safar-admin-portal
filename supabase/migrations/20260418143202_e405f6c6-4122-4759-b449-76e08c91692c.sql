-- =========================================================================
-- MESSAGES
-- =========================================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_type text NOT NULL CHECK (sender_type IN ('pilgrim','agent','system')),
  body text NOT NULL,
  attachments text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_rfq_created ON public.messages(rfq_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT: pilgrim who owns the RFQ, agent matched to the RFQ, or admin
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (
    public.is_rfq_owner(rfq_id)
    OR public.is_agent_matched_to_rfq(rfq_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- INSERT: only as yourself, and only if you're a participant
CREATE POLICY "Pilgrim sends messages on own RFQ"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_type = 'pilgrim'
    AND sender_id = auth.uid()
    AND public.is_rfq_owner(rfq_id)
  );

CREATE POLICY "Agent sends messages on matched RFQ"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_type = 'agent'
    AND sender_id = auth.uid()
    AND public.is_agent_matched_to_rfq(rfq_id)
  );

-- UPDATE: only mark-as-read on messages addressed to you (i.e. messages from the OTHER side)
CREATE POLICY "Participants mark messages read"
  ON public.messages FOR UPDATE
  USING (
    (public.is_rfq_owner(rfq_id) AND sender_type <> 'pilgrim')
    OR (public.is_agent_matched_to_rfq(rfq_id) AND sender_type <> 'agent')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- =========================================================================
-- QUOTE TEMPLATES
-- =========================================================================
CREATE TABLE public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  design_id smallint NOT NULL DEFAULT 1,
  html_template text NOT NULL DEFAULT '',
  merge_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_default boolean NOT NULL DEFAULT false,
  is_starter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_templates_agent ON public.quote_templates(agent_id);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- Starters (agent_id IS NULL, is_starter = true) are visible to everyone
-- Agent-owned templates only visible to the owner / admin
CREATE POLICY "Templates visible to owner, starters public"
  ON public.quote_templates FOR SELECT
  USING (
    is_starter = true
    OR (agent_id IS NOT NULL AND public.is_agent_owner(agent_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Agents create their own templates"
  ON public.quote_templates FOR INSERT
  WITH CHECK (
    agent_id IS NOT NULL
    AND public.is_agent_owner(agent_id)
    AND is_starter = false
  );

CREATE POLICY "Agents update their own templates"
  ON public.quote_templates FOR UPDATE
  USING (agent_id IS NOT NULL AND public.is_agent_owner(agent_id));

CREATE POLICY "Agents delete their own templates"
  ON public.quote_templates FOR DELETE
  USING (agent_id IS NOT NULL AND public.is_agent_owner(agent_id));

CREATE POLICY "Admins manage all templates"
  ON public.quote_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_quote_templates_touch
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enforce single default per agent
CREATE OR REPLACE FUNCTION public.enforce_single_default_quote_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default = true AND NEW.agent_id IS NOT NULL THEN
    UPDATE public.quote_templates
       SET is_default = false
     WHERE agent_id = NEW.agent_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quote_templates_single_default
  BEFORE INSERT OR UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_quote_template();

-- Notify pilgrim when a message arrives from the agent
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pilgrim uuid;
  v_agent_user uuid;
  v_agent_id uuid;
  v_agent_name text;
BEGIN
  IF NEW.sender_type = 'agent' THEN
    SELECT pilgrim_id INTO v_pilgrim FROM public.rfqs WHERE id = NEW.rfq_id;
    SELECT id, business_name INTO v_agent_id, v_agent_name
      FROM public.agents WHERE user_id = NEW.sender_id LIMIT 1;
    IF v_pilgrim IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_url)
      VALUES (
        v_pilgrim,
        'message_received',
        'New message',
        COALESCE(v_agent_name, 'An agent') || ': ' || left(NEW.body, 80),
        '/dashboard/rfqs/' || NEW.rfq_id::text
      );
    END IF;
  ELSIF NEW.sender_type = 'pilgrim' THEN
    -- Notify every matched agent
    FOR v_agent_user IN
      SELECT a.user_id
      FROM public.rfq_agent_matches m
      JOIN public.agents a ON a.id = m.agent_id
      WHERE m.rfq_id = NEW.rfq_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link_url)
      VALUES (
        v_agent_user,
        'message_received',
        'New message from pilgrim',
        left(NEW.body, 80),
        '/agent/leads'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();