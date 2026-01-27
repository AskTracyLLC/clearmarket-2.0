BEGIN;

-- =============================================================================
-- Vendor Onboarding Rewards v2 Migration
-- Implements tiered vendor rewards: 2 credits milestone + 3 credits full = 5 max
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create vendor_profile_verification_status view (Milestone - 2 credits)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vendor_profile_verification_status
WITH (security_invoker = true) AS
SELECT
  vp.id AS vendor_id,
  vp.user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.vendor_profile vp
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    -- Company name exists
    CASE WHEN vp.company_name IS NULL OR vp.company_name = '' 
         THEN 'company_name'::text END,
    -- Location (city + state)
    CASE WHEN vp.city IS NULL OR vp.state IS NULL 
         THEN 'location'::text END,
    -- Inspection types populated
    CASE WHEN vp.primary_inspection_types IS NULL 
         OR COALESCE(array_length(vp.primary_inspection_types, 1), 0) = 0 
         THEN 'inspection_types'::text END,
    -- At least one coverage area
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.vendor_coverage_areas vca
      WHERE vca.user_id = vp.user_id
    ) THEN 'coverage_area'::text END,
    -- Verification submitted (NULL-safe check)
    CASE WHEN vp.vendor_verification_status IS NULL 
         OR vp.vendor_verification_status = 'draft'
         THEN 'verification_submitted'::text END
  ], NULL::text) AS missing_required
) x;

-- Grant access
GRANT SELECT ON public.vendor_profile_verification_status TO authenticated;
REVOKE ALL ON public.vendor_profile_verification_status FROM anon;

-- -----------------------------------------------------------------------------
-- 2. Update vendor_onboarding_status view (Full - all 10 items)
-- Checklist items tracked via user_checklist_items require a 3-table join:
--   user_checklist_items.assignment_id -> user_checklist_assignments.id (user_id)
--   user_checklist_items.item_id -> checklist_items.id (auto_track_key)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.vendor_onboarding_status;

CREATE VIEW public.vendor_onboarding_status
WITH (security_invoker = true) AS
SELECT
  vp.id AS vendor_id,
  vp.user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.vendor_profile vp
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    -- 1. Company name exists
    CASE WHEN vp.company_name IS NULL OR vp.company_name = '' 
         THEN 'company_name'::text END,
    -- 2. Location (city + state)
    CASE WHEN vp.city IS NULL OR vp.state IS NULL 
         THEN 'location'::text END,
    -- 3. Inspection types populated
    CASE WHEN vp.primary_inspection_types IS NULL 
         OR COALESCE(array_length(vp.primary_inspection_types, 1), 0) = 0 
         THEN 'inspection_types'::text END,
    -- 4. At least one coverage area
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.vendor_coverage_areas vca
      WHERE vca.user_id = vp.user_id
    ) THEN 'coverage_area'::text END,
    -- 5. Verification submitted (NULL-safe check)
    CASE WHEN vp.vendor_verification_status IS NULL 
         OR vp.vendor_verification_status = 'draft'
         THEN 'verification_submitted'::text END,
    -- 6. First seeking coverage post
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.seeking_coverage_posts scp
      WHERE scp.vendor_id = vp.user_id
    ) THEN 'first_seeking_coverage_post'::text END,
    -- 7. First rep message sent (tracked via user_checklist_items with proper join)
    CASE WHEN NOT EXISTS (
      SELECT 1 
      FROM public.user_checklist_items uci
      JOIN public.user_checklist_assignments uca ON uci.assignment_id = uca.id
      JOIN public.checklist_items ci ON uci.item_id = ci.id
      WHERE uca.user_id = vp.user_id
        AND ci.auto_track_key = 'first_rep_message_sent'
        AND uci.status = 'completed'
    ) THEN 'first_rep_message_sent'::text END,
    -- 8. Vendor pricing saved (seeking coverage post with pay_max set)
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.seeking_coverage_posts scp
      WHERE scp.vendor_id = vp.user_id
        AND scp.pay_max IS NOT NULL
    ) THEN 'vendor_pricing_saved'::text END,
    -- 9. First agreement created
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.vendor_connections vc
      WHERE vc.vendor_id = vp.user_id
    ) THEN 'first_agreement_created'::text END,
    -- 10. First rep review submitted
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.reviewer_id = vp.user_id
        AND r.direction = 'vendor_to_rep'
    ) THEN 'first_rep_review_submitted'::text END,
    -- 11. First route alert acknowledged (tracked via user_checklist_items with proper join)
    CASE WHEN NOT EXISTS (
      SELECT 1 
      FROM public.user_checklist_items uci
      JOIN public.user_checklist_assignments uca ON uci.assignment_id = uca.id
      JOIN public.checklist_items ci ON uci.item_id = ci.id
      WHERE uca.user_id = vp.user_id
        AND ci.auto_track_key = 'first_route_alert_acknowledged'
        AND uci.status = 'completed'
    ) THEN 'first_route_alert_acknowledged'::text END,
    -- 12. Vendor calendar updated
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.vendor_office_hours voh
      WHERE voh.vendor_id = vp.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.vendor_calendar_events vce
      WHERE vce.vendor_id = vp.user_id
    ) THEN 'vendor_calendar_updated'::text END
  ], NULL::text) AS missing_required
) x;

-- Grant access
GRANT SELECT ON public.vendor_onboarding_status TO authenticated;
REVOKE ALL ON public.vendor_onboarding_status FROM anon;

-- -----------------------------------------------------------------------------
-- 3. Create award_vendor_profile_verification_credits RPC (Milestone - 2 credits)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_vendor_profile_verification_credits(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_complete boolean;
  v_already_awarded_total int;
  v_remaining int;
  v_award int;
  v_rows_affected int;
  v_new_balance int;
BEGIN
  -- Validate caller has access to this vendor
  IF NOT public.has_vendor_access_by_profile(p_vendor_id) THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Access denied'
    );
  END IF;

  -- Get user_id and completion status
  SELECT user_id, is_complete INTO v_user_id, v_is_complete
  FROM public.vendor_profile_verification_status
  WHERE vendor_id = p_vendor_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Vendor profile not found'
    );
  END IF;

  IF NOT v_is_complete THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Profile verification requirements not complete'
    );
  END IF;

  -- Total already awarded across vendor reward keys (including legacy)
  SELECT COALESCE(SUM(credits_awarded), 0) INTO v_already_awarded_total
  FROM public.onboarding_rewards
  WHERE subject_type = 'vendor'
    AND subject_id = p_vendor_id
    AND reward_key IN ('vendor_profile_verification_v1',
                       'vendor_onboarding_complete_v1',
                       'onboarding_complete_v1');

  v_remaining := GREATEST(5 - v_already_awarded_total, 0);

  IF v_remaining = 0 THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Maximum rewards already claimed'
    );
  END IF;

  -- Award up to 2 credits, but never exceed cap
  v_award := LEAST(2, v_remaining);

  -- Insert reward receipt (idempotent via unique constraint)
  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded)
  VALUES ('vendor', p_vendor_id, 'vendor_profile_verification_v1', v_award)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Milestone reward already claimed'
    );
  END IF;

  -- Credit the vendor wallet
  UPDATE public.vendor_wallet
  SET balance = balance + v_award, updated_at = now()
  WHERE vendor_id = p_vendor_id
  RETURNING balance INTO v_new_balance;

  -- If no wallet exists, create one
  IF v_new_balance IS NULL THEN
    INSERT INTO public.vendor_wallet (vendor_id, balance)
    VALUES (p_vendor_id, v_award)
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Log transaction
  INSERT INTO public.vendor_wallet_transactions (
    vendor_id, amount, txn_type, description
  ) VALUES (
    p_vendor_id, v_award, 'reward_profile_verification',
    'Onboarding milestone: Profile + Verification complete'
  );

  RETURN jsonb_build_object(
    'awarded', true,
    'credits_awarded', v_award,
    'new_balance', v_new_balance,
    'message', 'Milestone reward claimed successfully'
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.award_vendor_profile_verification_credits(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Update award_vendor_onboarding_credits RPC (Full - remainder up to 5)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_vendor_onboarding_credits(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_complete boolean;
  v_already_awarded int;
  v_remaining int;
  v_rows_affected int;
  v_new_balance int;
BEGIN
  -- Validate caller has access to this vendor
  IF NOT public.has_vendor_access_by_profile(p_vendor_id) THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Access denied'
    );
  END IF;

  -- Get user_id and completion status
  SELECT user_id, is_complete INTO v_user_id, v_is_complete
  FROM public.vendor_onboarding_status
  WHERE vendor_id = p_vendor_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Vendor profile not found'
    );
  END IF;

  IF NOT v_is_complete THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Onboarding requirements not complete'
    );
  END IF;

  -- Calculate total already awarded (milestone + any legacy)
  SELECT COALESCE(SUM(credits_awarded), 0) INTO v_already_awarded
  FROM public.onboarding_rewards
  WHERE subject_type = 'vendor'
    AND subject_id = p_vendor_id
    AND reward_key IN ('vendor_profile_verification_v1',
                       'vendor_onboarding_complete_v1',
                       'onboarding_complete_v1');

  v_remaining := GREATEST(5 - v_already_awarded, 0);

  -- Skip if nothing to award
  IF v_remaining = 0 THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Maximum rewards already claimed'
    );
  END IF;

  -- Insert reward receipt (idempotent via unique constraint)
  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded)
  VALUES ('vendor', p_vendor_id, 'vendor_onboarding_complete_v1', v_remaining)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'credits_awarded', 0,
      'message', 'Full onboarding reward already claimed'
    );
  END IF;

  -- Credit the vendor wallet
  UPDATE public.vendor_wallet
  SET balance = balance + v_remaining, updated_at = now()
  WHERE vendor_id = p_vendor_id
  RETURNING balance INTO v_new_balance;

  -- If no wallet exists, create one
  IF v_new_balance IS NULL THEN
    INSERT INTO public.vendor_wallet (vendor_id, balance)
    VALUES (p_vendor_id, v_remaining)
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Log transaction
  INSERT INTO public.vendor_wallet_transactions (
    vendor_id, amount, txn_type, description
  ) VALUES (
    p_vendor_id, v_remaining, 'reward_onboarding',
    'Onboarding complete: All checklist items finished'
  );

  RETURN jsonb_build_object(
    'awarded', true,
    'credits_awarded', v_remaining,
    'new_balance', v_new_balance,
    'message', 'Onboarding reward claimed successfully'
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.award_vendor_onboarding_credits(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Create get_vendor_reward_summary RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_reward_summary(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone_status record;
  v_onboarding_status record;
  v_milestone_earned int := 0;
  v_onboarding_earned int := 0;
  v_total_earned int;
BEGIN
  -- Validate caller has access
  IF NOT public.has_vendor_access_by_profile(p_vendor_id) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Get milestone status
  SELECT is_complete, missing_required INTO v_milestone_status
  FROM public.vendor_profile_verification_status
  WHERE vendor_id = p_vendor_id;

  -- Get full onboarding status
  SELECT is_complete, missing_required INTO v_onboarding_status
  FROM public.vendor_onboarding_status
  WHERE vendor_id = p_vendor_id;

  -- Get credits already earned for milestone
  SELECT COALESCE(credits_awarded, 0) INTO v_milestone_earned
  FROM public.onboarding_rewards
  WHERE subject_type = 'vendor'
    AND subject_id = p_vendor_id
    AND reward_key = 'vendor_profile_verification_v1';

  -- Get credits already earned for full onboarding (including legacy)
  SELECT COALESCE(SUM(credits_awarded), 0) INTO v_onboarding_earned
  FROM public.onboarding_rewards
  WHERE subject_type = 'vendor'
    AND subject_id = p_vendor_id
    AND reward_key IN ('vendor_onboarding_complete_v1', 'onboarding_complete_v1');

  v_total_earned := v_milestone_earned + v_onboarding_earned;

  RETURN jsonb_build_object(
    'milestone_complete', COALESCE(v_milestone_status.is_complete, false),
    'milestone_missing', COALESCE(v_milestone_status.missing_required, ARRAY[]::text[]),
    'milestone_earned', v_milestone_earned > 0,
    'milestone_credits', v_milestone_earned,
    'onboarding_complete', COALESCE(v_onboarding_status.is_complete, false),
    'onboarding_missing', COALESCE(v_onboarding_status.missing_required, ARRAY[]::text[]),
    'onboarding_earned', v_onboarding_earned > 0,
    'onboarding_credits', v_onboarding_earned,
    'total_earned', v_total_earned,
    'total_possible', 5,
    'remaining', GREATEST(5 - v_total_earned, 0)
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_vendor_reward_summary(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Refresh PostgREST schema cache
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;