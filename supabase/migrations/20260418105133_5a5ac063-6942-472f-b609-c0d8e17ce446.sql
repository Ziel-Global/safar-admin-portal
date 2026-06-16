
-- =====================
-- BOOKINGS
-- =====================
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  pilgrim_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  trip_start date,
  trip_end date,
  total_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id)
);

CREATE INDEX idx_bookings_pilgrim ON public.bookings(pilgrim_id);
CREATE INDEX idx_bookings_agent ON public.bookings(agent_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilgrims can view their own bookings"
  ON public.bookings FOR SELECT USING (pilgrim_id = auth.uid());

CREATE POLICY "Agents can view their own bookings"
  ON public.bookings FOR SELECT USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- bookings are created by triggers only
CREATE POLICY "Block direct booking inserts"
  ON public.bookings FOR INSERT WITH CHECK (false);

CREATE POLICY "Pilgrims can update their bookings"
  ON public.bookings FOR UPDATE USING (pilgrim_id = auth.uid());

CREATE POLICY "Agents can update their bookings"
  ON public.bookings FOR UPDATE USING (public.is_agent_owner(agent_id));

-- Trigger: auto-create a booking when a quote is accepted
CREATE OR REPLACE FUNCTION public.create_booking_on_quote_accept()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pilgrim uuid;
  v_date_from date;
  v_date_to date;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT pilgrim_id, date_from, date_to
      INTO v_pilgrim, v_date_from, v_date_to
    FROM public.rfqs WHERE id = NEW.rfq_id;

    INSERT INTO public.bookings (
      rfq_id, quote_id, pilgrim_id, agent_id, package_id,
      trip_start, trip_end, total_amount, currency, status
    ) VALUES (
      NEW.rfq_id, NEW.id, v_pilgrim, NEW.agent_id, NEW.package_id,
      v_date_from, v_date_to, NEW.price_total, NEW.price_currency, 'confirmed'
    )
    ON CONFLICT (quote_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quote_accept_booking
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.create_booking_on_quote_accept();

-- =====================
-- REVIEWS
-- =====================
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrim_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  overall_rating numeric(2,1) NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  dimensions jsonb NOT NULL,
  review_text text,
  is_verified boolean NOT NULL DEFAULT true,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  moderation_note text,
  agent_response text,
  agent_responded_at timestamptz,
  is_highlighted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX idx_reviews_agent_status ON public.reviews(agent_id, moderation_status);
CREATE INDEX idx_reviews_pilgrim ON public.reviews(pilgrim_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_reviews_touch
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: can the current user review this booking?
CREATE OR REPLACE FUNCTION public.can_review_booking(_booking_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = _booking_id
      AND b.pilgrim_id = auth.uid()
      AND b.trip_end IS NOT NULL
      AND b.trip_end < now()
      AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = _booking_id)
  )
$$;

CREATE POLICY "Approved reviews are public"
  ON public.reviews FOR SELECT
  USING (moderation_status = 'approved' OR pilgrim_id = auth.uid() OR public.is_agent_owner(agent_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Pilgrims can submit reviews for completed bookings"
  ON public.reviews FOR INSERT
  WITH CHECK (
    pilgrim_id = auth.uid()
    AND public.can_review_booking(booking_id)
  );

-- Pilgrims can edit their own review text/dimensions while pending
CREATE POLICY "Pilgrims can update their pending reviews"
  ON public.reviews FOR UPDATE
  USING (pilgrim_id = auth.uid() AND moderation_status = 'pending');

-- Agents can respond and highlight; column-level guard via trigger below
CREATE POLICY "Agents can respond to their reviews"
  ON public.reviews FOR UPDATE
  USING (public.is_agent_owner(agent_id));

CREATE POLICY "Admins can update any review"
  ON public.reviews FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- Trigger: when an agent updates a review, only allow agent_response, agent_responded_at, is_highlighted
CREATE OR REPLACE FUNCTION public.guard_review_agent_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_pilgrim boolean;
  v_highlight_count integer;
BEGIN
  v_is_admin := public.has_role(auth.uid(),'admin');
  v_is_owner := public.is_agent_owner(NEW.agent_id);
  v_is_pilgrim := (auth.uid() = OLD.pilgrim_id);

  -- Agent updating: restrict mutable columns
  IF v_is_owner AND NOT v_is_admin AND NOT v_is_pilgrim THEN
    IF NEW.pilgrim_id IS DISTINCT FROM OLD.pilgrim_id
       OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
       OR NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.overall_rating IS DISTINCT FROM OLD.overall_rating
       OR NEW.dimensions IS DISTINCT FROM OLD.dimensions
       OR NEW.review_text IS DISTINCT FROM OLD.review_text
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
       OR NEW.moderation_note IS DISTINCT FROM OLD.moderation_note THEN
      RAISE EXCEPTION 'Agents may only update agent_response and is_highlighted';
    END IF;

    -- stamp responded_at automatically when response changes
    IF NEW.agent_response IS DISTINCT FROM OLD.agent_response AND NEW.agent_response IS NOT NULL THEN
      NEW.agent_responded_at := now();
    END IF;
  END IF;

  -- Highlight cap: max 5 highlighted reviews per agent
  IF NEW.is_highlighted = true AND OLD.is_highlighted = false THEN
    SELECT COUNT(*) INTO v_highlight_count
    FROM public.reviews
    WHERE agent_id = NEW.agent_id AND is_highlighted = true AND id <> NEW.id;
    IF v_highlight_count >= 5 THEN
      RAISE EXCEPTION 'Highlight limit reached: max 5 highlighted reviews per agent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reviews_guard
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_agent_update();

-- Recalculate agent rating on review changes
CREATE OR REPLACE FUNCTION public.recalculate_agent_rating()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_agent uuid;
BEGIN
  v_agent := COALESCE(NEW.agent_id, OLD.agent_id);
  UPDATE public.agents a
  SET avg_rating = COALESCE(
        (SELECT ROUND(AVG(overall_rating)::numeric, 2)
         FROM public.reviews
         WHERE agent_id = v_agent AND moderation_status = 'approved'), 0),
      total_reviews = (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE agent_id = v_agent AND moderation_status = 'approved')
  WHERE a.id = v_agent;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_rating_iud
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_agent_rating();

-- =====================
-- REVIEW MEDIA
-- =====================
CREATE TABLE public.review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  url text NOT NULL,
  thumbnail_url text,
  label text,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_media_review ON public.review_media(review_id);

ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_review_owner(_review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.reviews WHERE id = _review_id AND pilgrim_id = auth.uid())
$$;

CREATE POLICY "Approved review media is public"
  ON public.review_media FOR SELECT
  USING (
    moderation_status = 'approved'
    OR public.is_review_owner(review_id)
    OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND public.is_agent_owner(r.agent_id))
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Pilgrims can add media to their reviews"
  ON public.review_media FOR INSERT
  WITH CHECK (public.is_review_owner(review_id));

CREATE POLICY "Pilgrims can delete their review media"
  ON public.review_media FOR DELETE
  USING (public.is_review_owner(review_id));

-- =====================
-- STORAGE BUCKET
-- =====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Review media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-media');

CREATE POLICY "Authenticated users can upload review media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own review media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-media' AND auth.uid()::text = (storage.foldername(name))[1]);
