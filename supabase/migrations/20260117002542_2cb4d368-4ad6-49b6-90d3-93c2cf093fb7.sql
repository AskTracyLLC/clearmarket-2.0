-- ==============================================================================
-- Onboarding Rewards v2: Rep Milestone (2 credits) + Fixed Alerts + Dashboard Visibility
-- FIXED:
--   - rush_price is OPTIONAL (base_price only required)
--   - Do NOT revoke INSERT for user_wallet_transactions (SECURITY DEFINER needs it)
--   - Add SELECT policy so reps can view their own transactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SAFETY GUARDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.onboarding_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('rep','vendor')),
  subject_id uuid NOT NULL,
  reward_key text NOT NULL,
  credits_awarded integer NOT NULL DEFAULT 5,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid NULL,
  UNIQUE(subject_type, subject_id, reward_key)
);

ALTER TABLE public.onboarding_rewards ENABLE ROW LEVEL SECURITY;

-- Make sure basic SELECT policies exist (idempotent)
DROP POLICY IF EXISTS "Reps can view their own onboarding rewards" ON public.onboarding_rewards;
CREATE POLICY "Reps can view their own onboarding rewards"
  ON public.onboarding_rewards
  FOR SELECT
  USING (subject_type = 'rep' AND subject_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can view their vendor onboarding rewards" ON public.onboarding_rewards;
CREATE POLICY "Vendors can view their vendor onboarding rewards"
  ON public.onboarding_rewards
  FOR SELECT
  USING (subject_type = 'vendor' AND public.has_vendor_access_by_profile(subject_id));

-- NOTE: No INSERT/UPDATE/DELETE policies => clients can't write via RLS

CREATE TABLE IF NOT EXISTS public.user_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  txn_type text NOT NULL,
  delta integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Rep can read their own log
DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.user_wallet_transactions;
CREATE POLICY "Users can view their own wallet transactions"
  ON public.user_wallet_transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Privileges:
-- Keep ANON locked down; allow authenticated to SELECT.
-- DO NOT revoke INSERT from authenticated (SECURITY DEFINER function may rely on it).
REVOKE ALL ON public.user_wallet_transactions FROM anon;
GRANT SELECT ON public.user_wallet_transactions TO authenticated;

-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_wallet_tx_user_type_time
  ON public.user_wallet_transactions (user_id, txn_type, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_wallet_transactions'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vendor_wallet_tx_vendor_type_time
             ON public.vendor_wallet_transactions (vendor_id, txn_type, created_at DESC)';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- VIEWS
-- ------------------------------------------------------------------------------

-- 1) Milestone: profile details + coverage pricing (base_price only)
CREATE OR REPLACE VIEW public.rep_profile_pricing_status AS
SELECT
  p.id AS rep_user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.profiles p
LEFT JOIN public.rep_profile rp ON rp.user_id = p.id
CROSS JOIN LATERAL (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN rp.user_id IS NULL THEN 'profile' END,
    CASE WHEN rp.city IS NULL OR rp.state IS NULL THEN 'location' END,
    CASE WHEN rp.inspection_types IS NULL OR coalesce(array_length(rp.inspection_types, 1), 0) = 0 THEN 'inspection_types' END,
    -- Pricing required = base_price only (rush_price OPTIONAL)
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.rep_coverage_areas rca
      WHERE rca.user_id = p.id
        AND rca.base_price IS NOT NULL
        AND rca.base_price > 0
    ) THEN 'coverage_pricing' END
  ], NULL) AS missing_required
) x
WHERE p.is_fieldrep = true;

-- 2) Full rep onboarding: milestone + route alert sent (vendor_alerts)
CREATE OR REPLACE VIEW public.rep_onboarding_status AS
SELECT
  p.id AS rep_user_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.profiles p
LEFT JOIN public.rep_profile rp ON rp.user_id = p.id
CROSS JOIN LATERAL (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN rp.user_id IS NULL THEN 'profile' END,
    CASE WHEN rp.city IS NULL OR rp.state IS NULL THEN 'location' END,
    CASE WHEN rp.inspection_types IS NULL OR coalesce(array_length(rp.inspection_types, 1), 0) = 0 THEN 'inspection_types' END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.rep_coverage_areas rca
      WHERE rca.user_id = p.id
        AND rca.base_price IS NOT NULL
        AND rca.base_price > 0
    ) THEN 'coverage_pricing' END,
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.vendor_alerts va
      WHERE va.rep_user_id = p.id
        AND va.sent_at IS NOT NULL
    ) THEN 'route_alert_sent' END
  ], NULL) AS missing_required
) x
WHERE p.is_fieldrep = true;

-- 3) Helper view for checklist sync
CREATE OR REPLACE VIEW public.rep_alert_sent_status AS
SELECT
  p.id AS rep_user_id,
  EXISTS (
    SELECT 1
    FROM public.vendor_alerts va
    WHERE va.rep_user_id = p.id
      AND va.sent_at IS NOT NULL
  ) AS has_sent_alert
FROM public.profiles p
WHERE p.is_fieldrep = true;

-- ------------------------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------------------------

-- 4) Award 2 credits for milestone
CREATE OR REPLACE FUNCTION public.award_rep_profile_pricing_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status record;
  v_new_balance integer;
  v_rowcount integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_status
  FROM public.rep_profile_pricing_status
  WHERE rep_user_id = v_user_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Rep profile pricing status not found');
  END IF;

  IF NOT v_status.is_complete THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Profile and pricing not complete', 'missing_required', v_status.missing_required);
  END IF;

  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded, awarded_by)
  VALUES ('rep', v_user_id, 'rep_profile_pricing_v1', 2, v_user_id)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Reward already applied');
  END IF;

  INSERT INTO public.user_wallet (user_id, credits)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallet
  SET credits = credits + 2, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING credits INTO v_new_balance;

  INSERT INTO public.user_wallet_transactions (user_id, actor_user_id, txn_type, delta, metadata)
  VALUES (
    v_user_id,
    v_user_id,
    'reward_profile_pricing',
    2,
    jsonb_build_object(
      'reward_key', 'rep_profile_pricing_v1',
      'subject_type', 'rep',
      'subject_id', v_user_id,
      'missing_required_at_award', v_status.missing_required
    )
  );

  RETURN jsonb_build_object('awarded', true, 'credits_awarded', 2, 'new_balance', v_new_balance, 'message', 'Profile pricing reward applied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_rep_profile_pricing_credits() TO authenticated;

-- 5) Award remaining credits to cap total at 5
CREATE OR REPLACE FUNCTION public.award_rep_onboarding_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status record;
  v_already_awarded integer;
  v_remaining integer;
  v_new_balance integer;
  v_rowcount integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_status
  FROM public.rep_onboarding_status
  WHERE rep_user_id = v_user_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Rep onboarding status not found');
  END IF;

  IF NOT v_status.is_complete THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Required onboarding items not complete', 'missing_required', v_status.missing_required);
  END IF;

  SELECT coalesce(sum(credits_awarded), 0) INTO v_already_awarded
  FROM public.onboarding_rewards
  WHERE subject_type = 'rep'
    AND subject_id = v_user_id
    AND reward_key IN ('rep_profile_pricing_v1', 'rep_onboarding_complete_v1');

  v_remaining := GREATEST(5 - v_already_awarded, 0);

  IF v_remaining = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'already_awarded', v_already_awarded, 'message', 'Maximum onboarding credits already awarded');
  END IF;

  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded, awarded_by)
  VALUES ('rep', v_user_id, 'rep_onboarding_complete_v1', v_remaining, v_user_id)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'already_awarded', v_already_awarded, 'message', 'Reward already applied');
  END IF;

  INSERT INTO public.user_wallet (user_id, credits)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallet
  SET credits = credits + v_remaining, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING credits INTO v_new_balance;

  INSERT INTO public.user_wallet_transactions (user_id, actor_user_id, txn_type, delta, metadata)
  VALUES (
    v_user_id,
    v_user_id,
    'reward_onboarding',
    v_remaining,
    jsonb_build_object(
      'reward_key', 'rep_onboarding_complete_v1',
      'subject_type', 'rep',
      'subject_id', v_user_id,
      'already_awarded', v_already_awarded,
      'remaining_awarded', v_remaining,
      'missing_required_at_award', v_status.missing_required
    )
  );

  RETURN jsonb_build_object(
    'awarded', true,
    'credits_awarded', v_remaining,
    'new_balance', v_new_balance,
    'already_awarded', v_already_awarded,
    'message', 'Onboarding reward applied'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_rep_onboarding_credits() TO authenticated;

-- 6) Reward summary for dashboard
CREATE OR REPLACE FUNCTION public.get_rep_reward_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_pricing_status record;
  v_onboarding_status record;
  v_milestone_earned boolean := false;
  v_onboarding_earned boolean := false;
  v_milestone_credits integer := 0;
  v_onboarding_credits integer := 0;
  v_total_earned integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_profile_pricing_status
  FROM public.rep_profile_pricing_status
  WHERE rep_user_id = v_user_id;

  SELECT * INTO v_onboarding_status
  FROM public.rep_onboarding_status
  WHERE rep_user_id = v_user_id;

  SELECT credits_awarded INTO v_milestone_credits
  FROM public.onboarding_rewards
  WHERE subject_type = 'rep'
    AND subject_id = v_user_id
    AND reward_key = 'rep_profile_pricing_v1';

  IF v_milestone_credits IS NOT NULL THEN
    v_milestone_earned := true;
  ELSE
    v_milestone_credits := 0;
  END IF;

  SELECT credits_awarded INTO v_onboarding_credits
  FROM public.onboarding_rewards
  WHERE subject_type = 'rep'
    AND subject_id = v_user_id
    AND reward_key = 'rep_onboarding_complete_v1';

  IF v_onboarding_credits IS NOT NULL THEN
    v_onboarding_earned := true;
  ELSE
    v_onboarding_credits := 0;
  END IF;

  v_total_earned := v_milestone_credits + v_onboarding_credits;

  RETURN jsonb_build_object(
    'milestone_complete', coalesce(v_profile_pricing_status.is_complete, false),
    'milestone_missing', coalesce(v_profile_pricing_status.missing_required, ARRAY[]::text[]),
    'milestone_earned', v_milestone_earned,
    'milestone_credits', v_milestone_credits,
    'onboarding_complete', coalesce(v_onboarding_status.is_complete, false),
    'onboarding_missing', coalesce(v_onboarding_status.missing_required, ARRAY[]::text[]),
    'onboarding_earned', v_onboarding_earned,
    'onboarding_credits', v_onboarding_credits,
    'total_earned', v_total_earned,
    'total_possible', 5,
    'remaining', GREATEST(5 - v_total_earned, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rep_reward_summary() TO authenticated;