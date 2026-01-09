-- =========================================================
-- HARD FIX: Eliminate vendor_staff recursion (clean-slate reset)
-- =========================================================

-- 1) Drop ALL existing policies on vendor_staff (names vary, so do it dynamically)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_staff'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vendor_staff;', r.policyname);
  END LOOP;
END$$;

-- 2) Make sure table is not FORCE RLS (force can break SECURITY DEFINER bypass)
ALTER TABLE public.vendor_staff NO FORCE ROW LEVEL SECURITY;

-- 3) Helper functions (SECURITY DEFINER + row_security off)
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_profile vp
    WHERE vp.id = p_vendor_id
      AND vp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendor_staff_member(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_staff vs
    WHERE vs.vendor_id = p_vendor_id
      AND vs.staff_user_id = p_user_id
      AND vs.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendor_staff_admin(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_staff vs
    WHERE vs.vendor_id = p_vendor_id
      AND vs.staff_user_id = p_user_id
      AND vs.status = 'active'
      AND vs.role IN ('owner','admin')
  );
$$;

-- 4) Lock down helper functions (no public execute)
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_staff_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_staff_admin(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_staff_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_staff_admin(uuid, uuid) TO authenticated;

-- 5) Recreate ONLY the two safe policies

-- SELECT: vendor owner OR any active staff member OR platform admin
CREATE POLICY vendor_staff_select
  ON public.vendor_staff
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_vendor_owner(vendor_staff.vendor_id, auth.uid())
    OR public.is_vendor_staff_member(vendor_staff.vendor_id, auth.uid())
  );

-- INSERT/UPDATE/DELETE: vendor owner OR vendor staff admin OR platform admin
CREATE POLICY vendor_staff_manage
  ON public.vendor_staff
  FOR ALL
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_vendor_owner(vendor_staff.vendor_id, auth.uid())
    OR public.is_vendor_staff_admin(vendor_staff.vendor_id, auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.is_vendor_owner(vendor_staff.vendor_id, auth.uid())
    OR public.is_vendor_staff_admin(vendor_staff.vendor_id, auth.uid())
  );