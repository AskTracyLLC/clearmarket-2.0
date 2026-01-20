BEGIN;

-- Phase 1: Make profiles.anonymous_id canonical

-- 1.1 Delete Tracy's orphaned rep_profile (admin, not a rep)
DELETE FROM public.rep_profile
WHERE user_id = '2398723e-5868-4553-a0aa-88dd83a4e895';

-- 1.2 Sync all rep_profile.anonymous_id to match profiles.anonymous_id
UPDATE public.rep_profile rp
SET anonymous_id = p.anonymous_id
FROM public.profiles p
WHERE rp.user_id = p.id
  AND p.anonymous_id IS NOT NULL
  AND (rp.anonymous_id IS NULL OR rp.anonymous_id <> p.anonymous_id);

-- 1.3 Sync trigger: profiles -> rep_profile (UNCONDITIONAL - no WHEN clause)
CREATE OR REPLACE FUNCTION public.sync_rep_profile_anon_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.anonymous_id IS DISTINCT FROM OLD.anonymous_id THEN
    UPDATE public.rep_profile
    SET anonymous_id = NEW.anonymous_id
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_rep_profile_anon_id ON public.profiles;
CREATE TRIGGER trg_sync_rep_profile_anon_id
AFTER UPDATE OF anonymous_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_rep_profile_anon_id();

-- 1.4 Safeguard trigger: prevent rep_profile from having a different anonymous_id
-- Fires on INSERT or UPDATE of anonymous_id OR user_id
CREATE OR REPLACE FUNCTION public.enforce_rep_profile_anon_id_from_profiles()
RETURNS TRIGGER AS $$
DECLARE
  canonical_anon_id TEXT;
BEGIN
  SELECT anonymous_id INTO canonical_anon_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF canonical_anon_id IS NOT NULL THEN
    NEW.anonymous_id := canonical_anon_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_rep_profile_anon_id ON public.rep_profile;
CREATE TRIGGER trg_enforce_rep_profile_anon_id
BEFORE INSERT OR UPDATE OF anonymous_id, user_id ON public.rep_profile
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rep_profile_anon_id_from_profiles();

COMMIT;