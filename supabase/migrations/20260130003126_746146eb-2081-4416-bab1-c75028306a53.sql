BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Helper: current rep_profile.id for auth.uid()
--    SECURITY DEFINER so it can be used inside rep_interest RLS without causing
--    rep_profile policy recursion.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_rep_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rp.id
  FROM public.rep_profile rp
  WHERE rp.user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_rep_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_rep_profile_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- 1) rep_profile SELECT policies (keep own/admin; vendor policy allowed only if
--    rep is interested in a post owned by vendor/vendor staff)
--    IMPORTANT: seeking_coverage_posts.vendor_id is vendor USER ID (profiles.id),
--    so join vendor_profile via vp.user_id = scp.vendor_id.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS rep_profile_select_own ON public.rep_profile;
CREATE POLICY rep_profile_select_own
ON public.rep_profile
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS rep_profile_select_admin_allowlist ON public.rep_profile;
CREATE POLICY rep_profile_select_admin_allowlist
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Vendors can view rep profiles for interested reps on their post" ON public.rep_profile;
CREATE POLICY "Vendors can view rep profiles for interested reps on their post"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rep_interest ri
    JOIN public.seeking_coverage_posts scp ON scp.id = ri.post_id
    JOIN public.vendor_profile vp ON vp.user_id = scp.vendor_id
    LEFT JOIN public.vendor_staff vs
      ON vs.vendor_id = vp.id
     AND vs.staff_user_id = auth.uid()
     AND vs.status = 'active'
    WHERE ri.rep_id = rep_profile.id
      AND (vp.user_id = auth.uid() OR vs.staff_user_id IS NOT NULL)
  )
);

-- -----------------------------------------------------------------------------
-- 2) rep_interest policies
--    KEY: Rep-side policies MUST NOT query rep_profile directly (prevents RLS loop).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Reps can express interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Reps can insert their own interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Reps can view their own interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Reps can view their own rep_interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Reps can update their own interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Reps can update their own rep_interest" ON public.rep_interest;

CREATE POLICY "Reps can insert their own interest"
ON public.rep_interest
FOR INSERT
TO authenticated
WITH CHECK (rep_id = public.current_rep_profile_id());

CREATE POLICY "Reps can view their own rep_interest"
ON public.rep_interest
FOR SELECT
TO authenticated
USING (rep_id = public.current_rep_profile_id());

CREATE POLICY "Reps can update their own rep_interest"
ON public.rep_interest
FOR UPDATE
TO authenticated
USING (rep_id = public.current_rep_profile_id())
WITH CHECK (rep_id = public.current_rep_profile_id());

-- -----------------------------------------------------------------------------
-- 3) Vendor/vendor staff access to rep_interest for posts they own
--    Again: scp.vendor_id is vendor USER ID; join vp via vp.user_id = scp.vendor_id
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view interest on their posts" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendors can update interest on their posts" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendors can view rep_interest for their posts" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendors can update rep_interest for their posts" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendor staff can view rep interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendor staff can update rep interest" ON public.rep_interest;

CREATE POLICY "Vendors can view rep_interest for their posts"
ON public.rep_interest
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seeking_coverage_posts scp
    JOIN public.vendor_profile vp ON vp.user_id = scp.vendor_id
    LEFT JOIN public.vendor_staff vs
      ON vs.vendor_id = vp.id
     AND vs.staff_user_id = auth.uid()
     AND vs.status = 'active'
    WHERE scp.id = rep_interest.post_id
      AND (vp.user_id = auth.uid() OR vs.staff_user_id IS NOT NULL)
  )
);

CREATE POLICY "Vendors can update rep_interest for their posts"
ON public.rep_interest
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seeking_coverage_posts scp
    JOIN public.vendor_profile vp ON vp.user_id = scp.vendor_id
    LEFT JOIN public.vendor_staff vs
      ON vs.vendor_id = vp.id
     AND vs.staff_user_id = auth.uid()
     AND vs.status = 'active'
    WHERE scp.id = rep_interest.post_id
      AND (vp.user_id = auth.uid() OR vs.staff_user_id IS NOT NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.seeking_coverage_posts scp
    JOIN public.vendor_profile vp ON vp.user_id = scp.vendor_id
    LEFT JOIN public.vendor_staff vs
      ON vs.vendor_id = vp.id
     AND vs.staff_user_id = auth.uid()
     AND vs.status = 'active'
    WHERE scp.id = rep_interest.post_id
      AND (vp.user_id = auth.uid() OR vs.staff_user_id IS NOT NULL)
  )
);

COMMIT;