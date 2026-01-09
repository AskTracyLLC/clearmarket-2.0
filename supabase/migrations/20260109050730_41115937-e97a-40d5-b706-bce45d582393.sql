-- Tighten rep_coverage_areas: only rep owner, admins, or connected vendors can see
ALTER TABLE IF EXISTS public.rep_coverage_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rep_coverage_areas FORCE ROW LEVEL SECURITY;

-- Revoke access from anonymous and public roles
REVOKE ALL ON TABLE public.rep_coverage_areas FROM anon;
REVOKE ALL ON TABLE public.rep_coverage_areas FROM PUBLIC;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view rep coverage for matching" ON public.rep_coverage_areas;

-- Rep can see their own coverage areas
DROP POLICY IF EXISTS "rep_coverage_areas_select_own" ON public.rep_coverage_areas;
CREATE POLICY "rep_coverage_areas_select_own"
ON public.rep_coverage_areas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins via allowlist can see all
DROP POLICY IF EXISTS "rep_coverage_areas_select_admin" ON public.rep_coverage_areas;
CREATE POLICY "rep_coverage_areas_select_admin"
ON public.rep_coverage_areas
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Connected vendors can see coverage for their connected reps
DROP POLICY IF EXISTS "rep_coverage_areas_select_connected_vendor" ON public.rep_coverage_areas;
CREATE POLICY "rep_coverage_areas_select_connected_vendor"
ON public.rep_coverage_areas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_connections vc
    WHERE vc.vendor_id = auth.uid()
      AND vc.field_rep_id = rep_coverage_areas.user_id
      AND vc.status = 'connected'::public.vendor_connection_status
  )
);