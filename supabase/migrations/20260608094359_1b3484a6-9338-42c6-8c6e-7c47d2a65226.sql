
DROP TRIGGER IF EXISTS trg_create_booking_on_quote_accept ON public.quotes;
CREATE TRIGGER trg_create_booking_on_quote_accept
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_booking_on_quote_accept();

DROP TRIGGER IF EXISTS trg_notify_on_quote_accepted ON public.quotes;
CREATE TRIGGER trg_notify_on_quote_accepted
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_quote_accepted();

DROP TRIGGER IF EXISTS trg_notify_on_new_quote ON public.quotes;
CREATE TRIGGER trg_notify_on_new_quote
  AFTER INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_quote();

DROP TRIGGER IF EXISTS trg_upsert_lead_on_quote ON public.quotes;
CREATE TRIGGER trg_upsert_lead_on_quote
  AFTER INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.upsert_lead_on_quote();
