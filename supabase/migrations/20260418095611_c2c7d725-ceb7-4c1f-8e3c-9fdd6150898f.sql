-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Trigger: notify pilgrim on new quote
CREATE OR REPLACE FUNCTION public.notify_on_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pilgrim uuid;
  v_agent_name text;
BEGIN
  SELECT pilgrim_id INTO v_pilgrim FROM public.rfqs WHERE id = NEW.rfq_id;
  SELECT business_name INTO v_agent_name FROM public.agents WHERE id = NEW.agent_id;
  IF v_pilgrim IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
      v_pilgrim,
      'quote_received',
      'New quote received',
      COALESCE(v_agent_name, 'An agent') || ' sent you a quote',
      '/dashboard/rfqs/' || NEW.rfq_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_quote
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_quote();

-- Trigger: notify agent on new RFQ match
CREATE OR REPLACE FUNCTION public.notify_on_rfq_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_city text;
  v_type text;
BEGIN
  SELECT user_id INTO v_user FROM public.agents WHERE id = NEW.agent_id;
  SELECT departure_city, type INTO v_city, v_type FROM public.rfqs WHERE id = NEW.rfq_id;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url)
    VALUES (
      v_user,
      'new_lead',
      'New lead matched',
      'A pilgrim from ' || COALESCE(v_city, 'unknown') || ' is requesting a ' || COALESCE(v_type, 'trip') || ' quote',
      '/agent/leads'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_rfq_match
AFTER INSERT ON public.rfq_agent_matches
FOR EACH ROW EXECUTE FUNCTION public.notify_on_rfq_match();

-- Trigger: notify agent when quote is accepted
CREATE OR REPLACE FUNCTION public.notify_on_quote_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT user_id INTO v_user FROM public.agents WHERE id = NEW.agent_id;
    IF v_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_url)
      VALUES (
        v_user,
        'quote_accepted',
        'Quote accepted! 🎉',
        'A pilgrim accepted your quote — contact them to confirm details',
        '/agent/leads'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_quote_accepted
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_quote_accepted();

-- Enable realtime
ALTER TABLE public.quotes REPLICA IDENTITY FULL;
ALTER TABLE public.rfq_agent_matches REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_agent_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;