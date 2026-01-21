-- 20260121_fix_fieldrep_anonymous_id.sql
-- Sequential FieldRep anonymous ID system

-- 1) Sequence for FieldRep# IDs (safe if rerun)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'fieldrep_anonymous_id_seq'
  ) THEN
    CREATE SEQUENCE public.fieldrep_anonymous_id_seq;
  END IF;
END $$;

-- 2) Next FieldRep anonymous ID (sequential, collision-safe)
CREATE OR REPLACE FUNCTION public.next_fieldrep_anonymous_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_next int;
BEGIN
  -- Prevent race conditions (two admins clicking at once)
  PERFORM pg_advisory_xact_lock(hashtext('fieldrep_anonymous_id_seq_lock'));

  -- Find current maximum FieldRep#N
  SELECT COALESCE(
    MAX((regexp_replace(anonymous_id, '^FieldRep#', ''))::int),
    0
  )
  INTO v_max
  FROM public.profiles
  WHERE anonymous_id ~ '^FieldRep#[0-9]+$';

  -- Force sequence to at least the max so nextval returns max+1
  PERFORM setval('public.fieldrep_anonymous_id_seq', v_max, true);

  v_next := nextval('public.fieldrep_anonymous_id_seq');

  RETURN 'FieldRep#' || v_next::text;
END;
$$;

REVOKE ALL ON FUNCTION public.next_fieldrep_anonymous_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_fieldrep_anonymous_id() TO authenticated;

-- 3) Admin RPC to assign/repair FieldRep anonymous ID
-- IMPORTANT: enforce admin-only execution inside the function.
CREATE OR REPLACE FUNCTION public.admin_revise_fieldrep_anonymous_id(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text;
  v_is_admin boolean;
BEGIN
  SELECT (is_admin OR is_super_admin) INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_new := public.next_fieldrep_anonymous_id();

  UPDATE public.profiles
  SET anonymous_id = v_new,
      updated_at = now()
  WHERE id = p_profile_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revise_fieldrep_anonymous_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revise_fieldrep_anonymous_id(uuid) TO authenticated;

-- 4) Backfill: Fix only BAD FieldRep anonymous IDs that are NOT sequential format
-- Do NOT renumber valid FieldRep#N values.
-- "Bad" examples: FieldRep#26e97229 (letters present).
DO $$
DECLARE
  r record;
  v_new text;
BEGIN
  FOR r IN
    SELECT id
    FROM public.profiles
    WHERE is_fieldrep = true
      AND anonymous_id IS NOT NULL
      AND anonymous_id !~ '^FieldRep#[0-9]+$'
      AND anonymous_id ~ '^FieldRep#'
  LOOP
    v_new := public.next_fieldrep_anonymous_id();
    UPDATE public.profiles
    SET anonymous_id = v_new,
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;

-- Notify schema cache reload
NOTIFY pgrst, 'reload schema';