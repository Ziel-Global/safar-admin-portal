
DROP TRIGGER IF EXISTS trg_create_booking_on_quote_accept ON public.quotes;
DROP TRIGGER IF EXISTS trg_notify_on_quote_accepted ON public.quotes;
DROP TRIGGER IF EXISTS trg_notify_on_new_quote ON public.quotes;
DROP TRIGGER IF EXISTS trg_upsert_lead_on_quote ON public.quotes;
