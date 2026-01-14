-- =========================================================
-- VENDOR STAFF RLS POLICIES v3 (FINAL CORRECTED)
-- Safe, idempotent, join-based where needed
-- =========================================================

-- ===================
-- HELPER FUNCTIONS
-- ===================

-- 1) Check if user is staff for a specific vendor_profile.id
CREATE OR REPLACE FUNCTION public.is_vendor_staff_for_vendor(
  p_vendor_profile_id uuid,
  p_staff_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_staff vs
    WHERE vs.vendor_id = p_vendor_profile_id
      AND vs.staff_user_id = p_staff_user_id
      AND vs.status = 'active'
  );
$$;

-- 2) Check if current user is owner OR staff (given owner_user_id)
CREATE OR REPLACE FUNCTION public.has_vendor_access_by_owner(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.uid() = p_owner_user_id
    OR EXISTS (
      SELECT 1
      FROM public.vendor_profile vp
      JOIN public.vendor_staff vs ON vs.vendor_id = vp.id
      WHERE vp.user_id = p_owner_user_id
        AND vs.staff_user_id = auth.uid()
        AND vs.status = 'active'
    )
  );
$$;

-- 3) Check if current user is owner OR staff (given vendor_profile.id)
CREATE OR REPLACE FUNCTION public.has_vendor_access_by_profile(p_vendor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_profile vp
    WHERE vp.id = p_vendor_profile_id
      AND (
        vp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.vendor_staff vs
          WHERE vs.vendor_id = vp.id
            AND vs.staff_user_id = auth.uid()
            AND vs.status = 'active'
        )
      )
  );
$$;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_vendor_staff_for_vendor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_vendor_access_by_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_vendor_access_by_profile(uuid) TO authenticated;

-- ===================
-- VENDOR_COVERAGE_AREAS (user_id = owner user id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view coverage areas" ON public.vendor_coverage_areas;
DROP POLICY IF EXISTS "Vendor staff can manage coverage areas" ON public.vendor_coverage_areas;

CREATE POLICY "Vendor staff can view coverage areas"
  ON public.vendor_coverage_areas FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(user_id));

CREATE POLICY "Vendor staff can manage coverage areas"
  ON public.vendor_coverage_areas FOR ALL TO authenticated
  USING (public.has_vendor_access_by_owner(user_id))
  WITH CHECK (public.has_vendor_access_by_owner(user_id));

-- ===================
-- SEEKING_COVERAGE_POSTS (vendor_id = owner user id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view seeking coverage posts" ON public.seeking_coverage_posts;
DROP POLICY IF EXISTS "Vendor staff can manage seeking coverage posts" ON public.seeking_coverage_posts;

CREATE POLICY "Vendor staff can view seeking coverage posts"
  ON public.seeking_coverage_posts FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id));

CREATE POLICY "Vendor staff can manage seeking coverage posts"
  ON public.seeking_coverage_posts FOR ALL TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id))
  WITH CHECK (public.has_vendor_access_by_owner(vendor_id));

-- ===================
-- REP_INTEREST (join through seeking_coverage_posts)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view rep interest" ON public.rep_interest;
DROP POLICY IF EXISTS "Vendor staff can update rep interest" ON public.rep_interest;

CREATE POLICY "Vendor staff can view rep interest"
  ON public.rep_interest FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seeking_coverage_posts scp
      WHERE scp.id = rep_interest.post_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  );

CREATE POLICY "Vendor staff can update rep interest"
  ON public.rep_interest FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seeking_coverage_posts scp
      WHERE scp.id = rep_interest.post_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seeking_coverage_posts scp
      WHERE scp.id = rep_interest.post_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  );

-- ===================
-- VENDOR_CONNECTIONS (vendor_id = owner user id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view connections" ON public.vendor_connections;
DROP POLICY IF EXISTS "Vendor staff can manage connections" ON public.vendor_connections;

CREATE POLICY "Vendor staff can view connections"
  ON public.vendor_connections FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id));

CREATE POLICY "Vendor staff can manage connections"
  ON public.vendor_connections FOR ALL TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id))
  WITH CHECK (public.has_vendor_access_by_owner(vendor_id));

-- ===================
-- VENDOR_OFFLINE_REP_CONTACTS (vendor_id = owner user id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view offline contacts" ON public.vendor_offline_rep_contacts;
DROP POLICY IF EXISTS "Vendor staff can manage offline contacts" ON public.vendor_offline_rep_contacts;

CREATE POLICY "Vendor staff can view offline contacts"
  ON public.vendor_offline_rep_contacts FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id));

CREATE POLICY "Vendor staff can manage offline contacts"
  ON public.vendor_offline_rep_contacts FOR ALL TO authenticated
  USING (public.has_vendor_access_by_owner(vendor_id))
  WITH CHECK (public.has_vendor_access_by_owner(vendor_id));

-- ===================
-- VENDOR_PROFILE (user_id = owner user id) - SELECT only for staff
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view vendor profile" ON public.vendor_profile;

CREATE POLICY "Vendor staff can view vendor profile"
  ON public.vendor_profile FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(user_id));

-- ===================
-- CONNECTION_AGREEMENT_AREAS (join through vendor_connections)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view agreement areas" ON public.connection_agreement_areas;
DROP POLICY IF EXISTS "Vendor staff can manage agreement areas" ON public.connection_agreement_areas;

CREATE POLICY "Vendor staff can view agreement areas"
  ON public.connection_agreement_areas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_connections vc
      WHERE vc.id = connection_agreement_areas.connection_id
        AND public.has_vendor_access_by_owner(vc.vendor_id)
    )
  );

CREATE POLICY "Vendor staff can manage agreement areas"
  ON public.connection_agreement_areas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_connections vc
      WHERE vc.id = connection_agreement_areas.connection_id
        AND public.has_vendor_access_by_owner(vc.vendor_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_connections vc
      WHERE vc.id = connection_agreement_areas.connection_id
        AND public.has_vendor_access_by_owner(vc.vendor_id)
    )
  );

-- ===================
-- CONNECTION_REVIEWS (join through rep_interest -> seeking_coverage_posts)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view connection reviews" ON public.connection_reviews;
DROP POLICY IF EXISTS "Vendor staff can manage connection reviews" ON public.connection_reviews;

CREATE POLICY "Vendor staff can view connection reviews"
  ON public.connection_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rep_interest ri
      JOIN public.seeking_coverage_posts scp ON scp.id = ri.post_id
      WHERE ri.id = connection_reviews.rep_interest_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  );

CREATE POLICY "Vendor staff can manage connection reviews"
  ON public.connection_reviews FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rep_interest ri
      JOIN public.seeking_coverage_posts scp ON scp.id = ri.post_id
      WHERE ri.id = connection_reviews.rep_interest_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rep_interest ri
      JOIN public.seeking_coverage_posts scp ON scp.id = ri.post_id
      WHERE ri.id = connection_reviews.rep_interest_id
        AND public.has_vendor_access_by_owner(scp.vendor_id)
    )
  );

-- ===================
-- CONVERSATIONS (participant_one or participant_two = vendor owner)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view conversations" ON public.conversations;

CREATE POLICY "Vendor staff can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.has_vendor_access_by_owner(participant_one)
    OR public.has_vendor_access_by_owner(participant_two)
  );

-- ===================
-- MESSAGES (join through conversations)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view messages" ON public.messages;

CREATE POLICY "Vendor staff can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          public.has_vendor_access_by_owner(c.participant_one)
          OR public.has_vendor_access_by_owner(c.participant_two)
        )
    )
  );

-- ===================
-- REP_VENDOR_CONTACTS (potential_vendor_profile_id = vendor_profile.id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view rep vendor contacts" ON public.rep_vendor_contacts;

CREATE POLICY "Vendor staff can view rep vendor contacts"
  ON public.rep_vendor_contacts FOR SELECT TO authenticated
  USING (
    potential_vendor_profile_id IS NOT NULL
    AND public.has_vendor_access_by_profile(potential_vendor_profile_id)
  );

-- ===================
-- NOTIFICATIONS (user_id = owner user id)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can view notifications" ON public.notifications;

CREATE POLICY "Vendor staff can view notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.has_vendor_access_by_owner(user_id));