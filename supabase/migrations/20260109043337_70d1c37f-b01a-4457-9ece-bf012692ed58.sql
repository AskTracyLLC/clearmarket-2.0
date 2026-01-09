-- FIX: rep_profile EXPOSED_SENSITIVE_DATA

-- A) Safe directory view (avoid city/zip/business/contact)
CREATE OR REPLACE VIEW public.rep_profile_public
WITH (security_invoker = true) AS
SELECT
  user_id,
  id,
  state,
  coverage_areas,
  inspection_types,
  systems_used,
  certifications,
  is_accepting_new_vendors,
  willing_to_travel_out_of_state,
  anonymous_id,
  background_check_is_active,
  has_hud_keys,
  open_to_new_systems,
  unavailable_from,
  unavailable_to,
  created_at,
  updated_at
FROM public.rep_profile;

GRANT SELECT ON public.rep_profile_public TO authenticated;

-- B) Lock down the base table
REVOKE ALL ON TABLE public.rep_profile FROM anon;
REVOKE ALL ON TABLE public.rep_profile FROM PUBLIC;

-- Drop overly-broad read policy
DROP POLICY IF EXISTS "Rep profiles are viewable by authenticated users" ON public.rep_profile;

-- Drop and recreate narrow policies
DROP POLICY IF EXISTS "rep_profile_select_own" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_admin" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_connected_vendor" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_unlocked_vendor" ON public.rep_profile;

-- Rep can view their own full profile
CREATE POLICY "rep_profile_select_own"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin/staff can view all profiles
CREATE POLICY "rep_profile_select_admin"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (is_staff_user(auth.uid()) OR is_admin_user(auth.uid()));

-- Connected vendor can view full rep profile
CREATE POLICY "rep_profile_select_connected_vendor"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_connections vc
    WHERE vc.vendor_id = auth.uid()
      AND vc.field_rep_id = rep_profile.user_id
      AND vc.status = 'connected'
  )
);

-- Vendor with paid unlock can view full rep profile
CREATE POLICY "rep_profile_select_unlocked_vendor"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rep_contact_unlocks u
    WHERE u.vendor_user_id = auth.uid()
      AND u.rep_user_id = rep_profile.user_id
  )
);