DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Block direct notification inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (false);