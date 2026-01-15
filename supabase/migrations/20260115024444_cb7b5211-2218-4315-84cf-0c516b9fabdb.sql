-- 1) Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS first_dashboard_accessed_at timestamptz;

-- 2) Add partial unique index (NULL-friendly)
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_anonymous_id
ON public.profiles (anonymous_id)
WHERE anonymous_id IS NOT NULL;

-- 3) Backfill profiles.anonymous_id from existing profile tables
-- rep_profile -> profiles
UPDATE public.profiles p
SET anonymous_id = rp.anonymous_id
FROM public.rep_profile rp
WHERE rp.id = p.id
  AND rp.anonymous_id IS NOT NULL
  AND p.anonymous_id IS NULL;

-- vendor_profile -> profiles (only if still null)
UPDATE public.profiles p
SET anonymous_id = vp.anonymous_id
FROM public.vendor_profile vp
WHERE vp.id = p.id
  AND vp.anonymous_id IS NOT NULL
  AND p.anonymous_id IS NULL;

-- 4) Bump sequences to avoid generating existing IDs
SELECT setval(
  'public.fieldrep_anon_seq',
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(anonymous_id, '^FieldRep#', ''), '')::bigint)
     FROM public.profiles
     WHERE anonymous_id LIKE 'FieldRep#%'),
    0
  ) + 1,
  false
);

SELECT setval(
  'public.vendor_anon_seq',
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(anonymous_id, '^Vendor#', ''), '')::bigint)
     FROM public.profiles
     WHERE anonymous_id LIKE 'Vendor#%'),
    0
  ) + 1,
  false
);

-- 5) Backfill dashboard access from auth users login history
UPDATE public.profiles p
SET first_dashboard_accessed_at = u.last_sign_in_at
FROM auth.users u
WHERE u.id = p.id
  AND p.first_dashboard_accessed_at IS NULL
  AND u.last_sign_in_at IS NOT NULL;

-- 6) Create RPC: stamp dashboard access + assign anon id
CREATE OR REPLACE FUNCTION public.ensure_anon_id_after_terms_and_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Stamp first dashboard access one-time
  UPDATE public.profiles
  SET first_dashboard_accessed_at = COALESCE(first_dashboard_accessed_at, now())
  WHERE id = v_user_id;

  -- Assign anon id ONLY if: terms signed + dashboard accessed + anon_id null
  UPDATE public.profiles p
  SET anonymous_id =
    CASE
      WHEN p.is_vendor_admin = TRUE THEN 'Vendor#'  || nextval('vendor_anon_seq')
      WHEN p.is_fieldrep   = TRUE THEN 'FieldRep#' || nextval('fieldrep_anon_seq')
      ELSE p.anonymous_id
    END
  WHERE p.id = v_user_id
    AND p.has_signed_terms = TRUE
    AND p.first_dashboard_accessed_at IS NOT NULL
    AND p.anonymous_id IS NULL
    AND (p.is_vendor_admin = TRUE OR p.is_fieldrep = TRUE);
END;
$$;

-- 7) Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_anon_id_after_terms_and_dashboard() TO authenticated;

-- 8) Batch assign for already-eligible users
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.profiles
    WHERE has_signed_terms = TRUE
      AND first_dashboard_accessed_at IS NOT NULL
      AND anonymous_id IS NULL
      AND (is_vendor_admin = TRUE OR is_fieldrep = TRUE)
  LOOP
    UPDATE public.profiles p
    SET anonymous_id =
      CASE
        WHEN p.is_vendor_admin = TRUE THEN 'Vendor#'  || nextval('vendor_anon_seq')
        WHEN p.is_fieldrep   = TRUE THEN 'FieldRep#' || nextval('fieldrep_anon_seq')
        ELSE p.anonymous_id
      END
    WHERE p.id = r.id
      AND p.anonymous_id IS NULL;
  END LOOP;
END $$;

-- 9) Update rep_profile trigger to inherit from profiles
CREATE OR REPLACE FUNCTION public.assign_rep_anonymous_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First check if profiles already has an anonymous_id
  SELECT p.anonymous_id
  INTO NEW.anonymous_id
  FROM public.profiles p
  WHERE p.id = NEW.id;

  -- If profiles doesn't have one, generate and write back
  IF NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'FieldRep#' || nextval('fieldrep_anon_seq');
    UPDATE public.profiles
    SET anonymous_id = NEW.anonymous_id
    WHERE id = NEW.id AND anonymous_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 10) Update vendor_profile trigger to inherit from profiles
CREATE OR REPLACE FUNCTION public.assign_vendor_anonymous_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First check if profiles already has an anonymous_id
  SELECT p.anonymous_id
  INTO NEW.anonymous_id
  FROM public.profiles p
  WHERE p.id = NEW.id;

  -- If profiles doesn't have one, generate and write back
  IF NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'Vendor#' || nextval('vendor_anon_seq');
    UPDATE public.profiles
    SET anonymous_id = NEW.anonymous_id
    WHERE id = NEW.id AND anonymous_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;