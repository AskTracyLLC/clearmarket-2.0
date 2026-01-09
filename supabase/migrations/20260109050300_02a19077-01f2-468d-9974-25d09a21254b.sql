-- Ensure RLS is enabled and forced on profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

-- Revoke access from anonymous and public roles
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;

-- Drop old admin update policy (uses is_admin_user function)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- Drop and recreate admin allowlist update policy with WITH CHECK
DROP POLICY IF EXISTS "profiles_update_admin_allowlist" ON public.profiles;
CREATE POLICY "profiles_update_admin_allowlist"
ON public.profiles
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Drop and recreate own update policy with WITH CHECK
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);