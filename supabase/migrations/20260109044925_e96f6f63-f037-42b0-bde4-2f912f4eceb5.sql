-- =====================================================
-- PROFILES: lock down cross-user reads + create staff-safe view
-- =====================================================

-- Ensure RLS is enforced
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

-- Remove any staff-wide/full-table read policies
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff_allowlist" ON public.profiles;

-- Keep only: self + admin allowlist
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin_allowlist" ON public.profiles;
CREATE POLICY "profiles_select_admin_allowlist"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

-- Create staff-safe view (note: with security_invoker=true, RLS on profiles still applies)
CREATE OR REPLACE VIEW public.profiles_staff_safe
WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  created_at
FROM public.profiles;

-- Restrict view privileges
REVOKE ALL ON public.profiles_staff_safe FROM PUBLIC;
GRANT SELECT ON public.profiles_staff_safe TO authenticated;