-- =====================================================
-- Option A: Split contact/location out of rep_profile
-- Use existing public.background_checks (already admin-gated)
-- GL verification NOT required for vendor access
-- =====================================================

-- 0) Ensure rep_profile is locked down (no vendor reads)
ALTER TABLE IF EXISTS public.rep_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rep_profile FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rep_profile FROM anon;
REVOKE ALL ON TABLE public.rep_profile FROM PUBLIC;

-- If any vendor SELECT policies still exist on rep_profile, remove them
DROP POLICY IF EXISTS "rep_profile_select_connected_vendor" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_unlocked_vendor" ON public.rep_profile;

-- 1) Create rep_contact_info (vendor-gated)
CREATE TABLE IF NOT EXISTS public.rep_contact_info (
  rep_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text,
  city text,
  zip_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rep_contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_contact_info FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rep_contact_info FROM anon;
REVOKE ALL ON TABLE public.rep_contact_info FROM PUBLIC;

-- Rep can read their own contact info
DROP POLICY IF EXISTS "rep_contact_select_own" ON public.rep_contact_info;
CREATE POLICY "rep_contact_select_own"
ON public.rep_contact_info
FOR SELECT
TO authenticated
USING (auth.uid() = rep_user_id);

-- Rep can insert/update/delete their own contact info
DROP POLICY IF EXISTS "rep_contact_manage_own" ON public.rep_contact_info;
CREATE POLICY "rep_contact_manage_own"
ON public.rep_contact_info
FOR ALL
TO authenticated
USING (auth.uid() = rep_user_id)
WITH CHECK (auth.uid() = rep_user_id);

-- Admin allowlist can read all
DROP POLICY IF EXISTS "rep_contact_select_admin_allowlist" ON public.rep_contact_info;
CREATE POLICY "rep_contact_select_admin_allowlist"
ON public.rep_contact_info
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Vendors can read ONLY if:
-- - vendor role + active account
-- - AND connected OR unlocked
-- (GL verification NOT required)
DROP POLICY IF EXISTS "rep_contact_select_vendor_connected_or_unlocked" ON public.rep_contact_info;
CREATE POLICY "rep_contact_select_vendor_connected_or_unlocked"
ON public.rep_contact_info
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_vendor_admin = true
      AND p.account_status = 'active'
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.vendor_connections vc
      WHERE vc.vendor_id = auth.uid()
        AND vc.field_rep_id = rep_contact_info.rep_user_id
        AND vc.status = 'connected'::public.vendor_connection_status
    )
    OR EXISTS (
      SELECT 1
      FROM public.rep_contact_unlocks u
      WHERE u.vendor_user_id = auth.uid()
        AND u.rep_user_id = rep_contact_info.rep_user_id
    )
  )
);

-- 2) Backfill rep_contact_info from rep_profile
INSERT INTO public.rep_contact_info (rep_user_id, business_name, city, zip_code)
SELECT user_id, business_name, city, zip_code
FROM public.rep_profile
WHERE user_id IS NOT NULL
ON CONFLICT (rep_user_id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  city = EXCLUDED.city,
  zip_code = EXCLUDED.zip_code,
  updated_at = now();

-- 3) Scrub sensitive fields from rep_profile (so scanner stops flagging rep_profile)
UPDATE public.rep_profile
SET
  business_name = NULL,
  city = NULL,
  zip_code = NULL,
  background_check_expires_on = NULL,
  background_check_provider_other_name = NULL,
  background_check_id = NULL,
  background_check_screenshot_url = NULL
WHERE
  business_name IS NOT NULL
  OR city IS NOT NULL
  OR zip_code IS NOT NULL
  OR background_check_expires_on IS NOT NULL
  OR background_check_provider_other_name IS NOT NULL
  OR background_check_id IS NOT NULL
  OR background_check_screenshot_url IS NOT NULL;

-- 4) Drop and recreate public directory view (removing background_check_is_active, keeping safe columns)
DROP VIEW IF EXISTS public.rep_profile_public;

CREATE VIEW public.rep_profile_public
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
  has_hud_keys,
  open_to_new_systems,
  unavailable_from,
  unavailable_to,
  equipment_notes,
  created_at,
  updated_at
FROM public.rep_profile;

GRANT SELECT ON public.rep_profile_public TO authenticated;