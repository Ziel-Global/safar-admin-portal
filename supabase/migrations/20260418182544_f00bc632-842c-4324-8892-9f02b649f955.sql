-- Add soft-delete column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- When a profile is soft-deleted, deactivate the agent record (if any)
CREATE OR REPLACE FUNCTION public.handle_profile_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL) THEN
    UPDATE public.agents
       SET status = 'inactive', updated_at = now()
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_soft_delete ON public.profiles;
CREATE TRIGGER trg_profile_soft_delete
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_soft_delete();