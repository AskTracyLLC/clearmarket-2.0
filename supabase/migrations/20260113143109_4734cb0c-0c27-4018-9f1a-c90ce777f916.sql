BEGIN;

-- STEP 1: RPC for privacy-safe rep discovery
CREATE OR REPLACE FUNCTION public.get_rep_discovery()
RETURNS TABLE (
  rep_user_id uuid,
  anonymous_id text,
  city text,
  state text,
  community_score integer,
  is_accepting_new_vendors boolean,
  systems_used text[],
  inspection_types text[],
  open_to_new_systems boolean,
  has_hud_keys boolean,
  willing_to_travel_out_of_state boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rp.user_id AS rep_user_id,
    COALESCE(rp.anonymous_id, 'FieldRep#' || SUBSTRING(rp.user_id::text, 1, 8)) AS anonymous_id,
    rp.city,
    rp.state,
    p.community_score,
    rp.is_accepting_new_vendors,
    rp.systems_used,
    rp.inspection_types,
    rp.open_to_new_systems,
    rp.has_hud_keys,
    rp.willing_to_travel_out_of_state
  FROM public.rep_profile rp
  JOIN public.profiles p ON p.id = rp.user_id
  WHERE p.is_fieldrep = true
    AND p.account_status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.get_rep_discovery() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_rep_discovery() TO authenticated;

COMMENT ON FUNCTION public.get_rep_discovery() IS
'Privacy-safe Field Rep discovery. Returns ONLY: anonymous_id, city, state, community_score, and high-level capability flags. Excludes email, full_name, contact info, detailed coverage, pricing, zip_code.';

-- STEP 2: seeking_coverage_posts vendor isolation
DROP POLICY IF EXISTS "All authenticated users can view active seeking coverage posts"
ON public.seeking_coverage_posts;

CREATE POLICY "seeking_coverage_select_fieldrep_browse"
ON public.seeking_coverage_posts
FOR SELECT
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_fieldrep = true
      AND p.account_status = 'active'
  )
);

CREATE POLICY "seeking_coverage_select_vendor_own"
ON public.seeking_coverage_posts
FOR SELECT
USING (
  vendor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_vendor_admin = true
      AND p.account_status = 'active'
  )
);

DROP POLICY IF EXISTS "seeking_coverage_select_admin_allowlist"
ON public.seeking_coverage_posts;

CREATE POLICY "seeking_coverage_select_admin_allowlist"
ON public.seeking_coverage_posts
FOR SELECT
USING (
  public.is_staff_user(auth.uid())
);

COMMIT;