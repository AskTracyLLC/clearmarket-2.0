-- =========================================================
-- MIGRATION A (SAFE): Fix territory_assignments FK blockers
-- Goal:
--   - User-owned rows should not block deletion (CASCADE)
--   - Reference/audit columns should preserve history (SET NULL)
-- =========================================================

-- -------------------------------------------------------------------
-- 0) Make reference/audit columns nullable (only if the columns exist)
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'territory_assignments'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'ALTER TABLE public.territory_assignments ALTER COLUMN created_by DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'territory_assignments'
      AND column_name = 'rep_confirmed_by'
  ) THEN
    EXECUTE 'ALTER TABLE public.territory_assignments ALTER COLUMN rep_confirmed_by DROP NOT NULL';
  END IF;
END $$;

-- -------------------------------------------------------------------
-- 1) rep_id: CASCADE (user-owned assignment rows)
-- -------------------------------------------------------------------
ALTER TABLE public.territory_assignments
  DROP CONSTRAINT IF EXISTS territory_assignments_rep_id_fkey;

ALTER TABLE public.territory_assignments
  ADD CONSTRAINT territory_assignments_rep_id_fkey
  FOREIGN KEY (rep_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- -------------------------------------------------------------------
-- 2) vendor_id: CASCADE (vendor owner user/profile)
-- -------------------------------------------------------------------
ALTER TABLE public.territory_assignments
  DROP CONSTRAINT IF EXISTS territory_assignments_vendor_id_fkey;

ALTER TABLE public.territory_assignments
  ADD CONSTRAINT territory_assignments_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- -------------------------------------------------------------------
-- 3) created_by: SET NULL (audit/reference)
-- -------------------------------------------------------------------
ALTER TABLE public.territory_assignments
  DROP CONSTRAINT IF EXISTS territory_assignments_created_by_fkey;

ALTER TABLE public.territory_assignments
  ADD CONSTRAINT territory_assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- -------------------------------------------------------------------
-- 4) rep_confirmed_by: SET NULL (audit/reference)
-- -------------------------------------------------------------------
ALTER TABLE public.territory_assignments
  DROP CONSTRAINT IF EXISTS territory_assignments_rep_confirmed_by_fkey;

ALTER TABLE public.territory_assignments
  ADD CONSTRAINT territory_assignments_rep_confirmed_by_fkey
  FOREIGN KEY (rep_confirmed_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;