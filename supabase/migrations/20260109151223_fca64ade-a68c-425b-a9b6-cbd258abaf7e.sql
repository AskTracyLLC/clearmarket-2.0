-- =====================================================
-- FIX: RLS infinite recursion on admin_users / staff_users
-- Use SECURITY DEFINER helper functions with row_security = off
-- =====================================================

-- 0) Make sure authenticated has table privileges (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_users TO authenticated;

-- 1) Drop recursive + prior policies (old + new names)
DROP POLICY IF EXISTS "admin_users_admin_manage" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_delete" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_admin_all" ON public.admin_users;

DROP POLICY IF EXISTS "staff_users_admin_manage" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_select" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_insert" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_delete" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_select_self" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_admin_all" ON public.staff_users;

-- 2) Create helper functions that bypass RLS safely (no recursion)
CREATE OR REPLACE FUNCTION public.is_admin_allowlisted(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_allowlisted(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_admin_allowlisted(p_user_id)
    OR EXISTS (SELECT 1 FROM public.staff_users su WHERE su.user_id = p_user_id);
$$;

-- Allow authenticated users to execute these checks
GRANT EXECUTE ON FUNCTION public.is_admin_allowlisted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_allowlisted(uuid) TO authenticated;

-- 3) RLS: admin_users
-- Users can see their own row (lets the app check "am I admin?")
CREATE POLICY "admin_users_select_self"
ON public.admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage admin allowlist (and see all rows)
CREATE POLICY "admin_users_admin_all"
ON public.admin_users
FOR ALL
TO authenticated
USING (public.is_admin_allowlisted(auth.uid()))
WITH CHECK (public.is_admin_allowlisted(auth.uid()));

-- 4) RLS: staff_users
-- Staff can see their own row
CREATE POLICY "staff_users_select_self"
ON public.staff_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage staff allowlist (and see all rows)
CREATE POLICY "staff_users_admin_all"
ON public.staff_users
FOR ALL
TO authenticated
USING (public.is_admin_allowlisted(auth.uid()))
WITH CHECK (public.is_admin_allowlisted(auth.uid()));