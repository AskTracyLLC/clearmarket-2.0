-- =========================================================
-- FIX: Remove vendor_staff RLS recursion by using helper functions
-- =========================================================

-- 1) Helper: is platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.is_admin = true
  );
$$;

-- 2) Helper: is vendor owner (vendor_profile.user_id)
CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_profile vp
    WHERE vp.id = p_vendor_id
      AND vp.user_id = p_user_id
  );
$$;

-- 3) Helper: is active vendor staff member (any role)
CREATE OR REPLACE FUNCTION public.is_vendor_staff_member(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_staff vs
    WHERE vs.vendor_id = p_vendor_id
      AND vs.staff_user_id = p_user_id
      AND vs.status = 'active'
  );
$$;

-- 4) Helper: is vendor staff admin (owner/admin role)
CREATE OR REPLACE FUNCTION public.is_vendor_staff_admin(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- Lock down the helper functions
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_staff_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vendor_staff_admin(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_staff_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_staff_admin(uuid, uuid) TO authenticated;

-- 5) Drop older policies that may cause recursion
DROP POLICY IF EXISTS "Vendor owner/admin can manage staff" ON public.vendor_staff;
DROP POLICY IF EXISTS "Staff can view own vendor staff" ON public.vendor_staff;
DROP POLICY IF EXISTS "Admins can view all vendor staff" ON public.vendor_staff;
DROP POLICY IF EXISTS "Vendor owners can manage staff" ON public.vendor_staff;
DROP POLICY IF EXISTS "Staff can view vendor staff list" ON public.vendor_staff;
DROP POLICY IF EXISTS "vendor_staff_select" ON public.vendor_staff;
DROP POLICY IF EXISTS "vendor_staff_manage" ON public.vendor_staff;

-- 6) Recreate policies WITHOUT querying vendor_staff inside policy body
-- SELECT: vendor owner OR any active staff member OR platform admin
CREATE POLICY "vendor_staff_select"
  ON public.vendor_staff
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_vendor_owner(vendor_staff.vendor_id, auth.uid())
    OR public.is_vendor_staff_member(vendor_staff.vendor_id, auth.uid())
  );

-- INSERT/UPDATE/DELETE: vendor owner OR vendor staff admin OR platform admin
CREATE POLICY "vendor_staff_manage"
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