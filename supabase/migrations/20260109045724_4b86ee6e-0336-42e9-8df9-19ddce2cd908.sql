-- Drop broad policies that use is_staff_user or have public roles
DROP POLICY IF EXISTS "Staff can view all rep profiles" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_admin" ON public.rep_profile;
DROP POLICY IF EXISTS "Users can manage their own rep profile" ON public.rep_profile;

-- Recreate admin policy using allowlist only
DROP POLICY IF EXISTS "rep_profile_select_admin_allowlist" ON public.rep_profile;
CREATE POLICY "rep_profile_select_admin_allowlist"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

-- Recreate own-profile policies with proper roles
DROP POLICY IF EXISTS "rep_profile_insert_own" ON public.rep_profile;
CREATE POLICY "rep_profile_insert_own"
ON public.rep_profile
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rep_profile_update_own" ON public.rep_profile;
CREATE POLICY "rep_profile_update_own"
ON public.rep_profile
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rep_profile_delete_own" ON public.rep_profile;
CREATE POLICY "rep_profile_delete_own"
ON public.rep_profile
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Revoke public access
REVOKE ALL ON TABLE public.rep_profile FROM anon;
REVOKE ALL ON TABLE public.rep_profile FROM PUBLIC;