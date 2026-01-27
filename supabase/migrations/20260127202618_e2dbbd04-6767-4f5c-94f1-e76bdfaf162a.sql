BEGIN;

-- Add toggle column to vendor_profile for showing seeking coverage areas on public profile
ALTER TABLE public.vendor_profile
ADD COLUMN IF NOT EXISTS show_seeking_coverage_on_public_profile boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_profile.show_seeking_coverage_on_public_profile IS
'When true, public vendor profile displays states/counties of active Seeking Coverage posts';

-- Create RPC to return only state_code + county_name for active, non-expired seeking coverage posts
DROP FUNCTION IF EXISTS public.get_vendor_open_seeking_coverage_areas(uuid);

CREATE OR REPLACE FUNCTION public.get_vendor_open_seeking_coverage_areas(p_vendor_id uuid)
RETURNS TABLE(state_code text, county_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT 
    COALESCE(scp.state_code, uc.state_code) AS state_code,
    COALESCE(uc.county_name, 'Statewide') AS county_name
  FROM public.seeking_coverage_posts scp
  LEFT JOIN public.us_counties uc ON uc.id = scp.county_id
  WHERE scp.vendor_id = p_vendor_id
    AND scp.status = 'active'
    AND scp.deleted_at IS NULL
    AND (scp.auto_expires_at IS NULL OR scp.auto_expires_at > now());
$$;

COMMENT ON FUNCTION public.get_vendor_open_seeking_coverage_areas(uuid) IS
'Returns distinct state_code and county_name pairs for active/non-expired seeking coverage posts by vendor. Used for public profile display.';

-- Grant execute to anon (public profile) and authenticated
GRANT EXECUTE ON FUNCTION public.get_vendor_open_seeking_coverage_areas(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_open_seeking_coverage_areas(uuid) TO authenticated;

COMMIT;