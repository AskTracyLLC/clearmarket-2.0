BEGIN;

-- 1) Fix vendor ability to see rep profiles for reps interested in their posts
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
    WHERE ri.rep_id = rep_profile.id
      AND has_vendor_access_by_profile(scp.vendor_id)
  )
);

-- 2) Fix rep_interest SELECT policy (rep_id stores rep_profile.id, not auth.uid)
DROP POLICY IF EXISTS "Reps can view their own rep_interest" ON public.rep_interest;

CREATE POLICY "Reps can view their own rep_interest"
ON public.rep_interest
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rep_profile rp
    WHERE rp.id = rep_interest.rep_id
      AND rp.user_id = auth.uid()
  )
);

COMMIT;