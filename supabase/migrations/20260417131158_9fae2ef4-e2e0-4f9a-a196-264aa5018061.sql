-- Create public storage bucket for package media
INSERT INTO storage.buckets (id, name, public)
VALUES ('package-media', 'package-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create package_media table
CREATE TABLE public.package_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  label text CHECK (label IN ('hotel_exterior','room','transport','meals','haram_proximity','general')),
  sort_order smallint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_package_media_package_id ON public.package_media(package_id);
CREATE INDEX idx_package_media_sort ON public.package_media(package_id, sort_order);

-- Helper function: is the current user the owner of the package containing this media?
CREATE OR REPLACE FUNCTION public.is_media_package_owner(_package_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.packages p
    JOIN public.agents a ON a.id = p.agent_id
    WHERE p.id = _package_id
      AND a.user_id = auth.uid()
  )
$$;

-- Enable RLS
ALTER TABLE public.package_media ENABLE ROW LEVEL SECURITY;

-- Public can view approved media; owners and admins can view their own regardless
CREATE POLICY "Approved media is viewable by everyone"
ON public.package_media
FOR SELECT
USING (
  moderation_status = 'approved'
  OR public.is_media_package_owner(package_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Agents can insert media for their own packages"
ON public.package_media
FOR INSERT
WITH CHECK (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can update media for their own packages"
ON public.package_media
FOR UPDATE
USING (public.is_media_package_owner(package_id));

CREATE POLICY "Agents can delete media for their own packages"
ON public.package_media
FOR DELETE
USING (public.is_media_package_owner(package_id));

CREATE POLICY "Admins can update any media"
ON public.package_media
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any media"
ON public.package_media
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies for package-media bucket
CREATE POLICY "Package media is publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'package-media');

CREATE POLICY "Authenticated users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'package-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own package media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'package-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own package media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'package-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);