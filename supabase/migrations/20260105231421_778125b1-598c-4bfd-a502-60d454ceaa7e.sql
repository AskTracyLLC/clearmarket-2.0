-- 1) Normalize any existing inconsistent rows so the constraint can be added safely
UPDATE public.profiles
SET active_role = CASE
  -- Dual Role: if active_role is null, default to 'rep'
  WHEN COALESCE(is_fieldrep, false) = true AND COALESCE(is_vendor_admin, false) = true
    THEN COALESCE(active_role, 'rep')

  -- Rep only
  WHEN COALESCE(is_fieldrep, false) = true AND COALESCE(is_vendor_admin, false) = false
    THEN 'rep'

  -- Vendor only
  WHEN COALESCE(is_vendor_admin, false) = true AND COALESCE(is_fieldrep, false) = false
    THEN 'vendor'

  -- Neither role
  ELSE NULL
END
WHERE
  -- active_role doesn't match role flags
  (active_role = 'rep' AND COALESCE(is_fieldrep, false) = false)
  OR (active_role = 'vendor' AND COALESCE(is_vendor_admin, false) = false)
  OR (
    active_role IS NULL AND (
      COALESCE(is_fieldrep, false) = true OR COALESCE(is_vendor_admin, false) = true
    )
  );

-- 2) Add a DB-level constraint to ensure active_role can't contradict the flags
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_active_role_matches_flags
CHECK (
  active_role IS NULL
  OR (active_role = 'rep' AND COALESCE(is_fieldrep, false) = true)
  OR (active_role = 'vendor' AND COALESCE(is_vendor_admin, false) = true)
) NOT VALID;

ALTER TABLE public.profiles
VALIDATE CONSTRAINT profiles_active_role_matches_flags;

-- 3) Add a trigger that auto-normalizes on insert/update so writes don't fail unexpectedly
CREATE OR REPLACE FUNCTION public.enforce_profiles_active_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- normalize null booleans (optional but helpful)
  IF NEW.is_fieldrep IS NULL THEN NEW.is_fieldrep := false; END IF;
  IF NEW.is_vendor_admin IS NULL THEN NEW.is_vendor_admin := false; END IF;

  -- If active_role is set to something the user doesn't actually have, fix it.
  IF NEW.active_role = 'rep' AND NEW.is_fieldrep = false THEN
    IF NEW.is_vendor_admin = true THEN
      NEW.active_role := 'vendor';
    ELSE
      NEW.active_role := NULL;
    END IF;

  ELSIF NEW.active_role = 'vendor' AND NEW.is_vendor_admin = false THEN
    IF NEW.is_fieldrep = true THEN
      NEW.active_role := 'rep';
    ELSE
      NEW.active_role := NULL;
    END IF;
  END IF;

  -- If active_role is NULL, set it intelligently based on available roles.
  IF NEW.active_role IS NULL THEN
    IF NEW.is_fieldrep = true AND NEW.is_vendor_admin = false THEN
      NEW.active_role := 'rep';
    ELSIF NEW.is_vendor_admin = true AND NEW.is_fieldrep = false THEN
      NEW.active_role := 'vendor';
    ELSIF NEW.is_fieldrep = true AND NEW.is_vendor_admin = true THEN
      NEW.active_role := 'rep'; -- default for Dual Role
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profiles_active_role ON public.profiles;

CREATE TRIGGER trg_enforce_profiles_active_role
BEFORE INSERT OR UPDATE OF is_fieldrep, is_vendor_admin, active_role
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profiles_active_role();