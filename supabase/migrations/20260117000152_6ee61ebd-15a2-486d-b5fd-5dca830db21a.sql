-- ==============================================================================
-- Onboarding Completion Reward System (REQUIRED items only) - v4 CORRECTED
-- Awards 5 credits ONCE, logs transaction, and is auditable by timestamp
-- ==============================================================================

-- 1) Idempotency receipt table
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

DROP POLICY IF EXISTS "Reps can view their own onboarding rewards" ON public.onboarding_rewards;
CREATE POLICY "Reps can view their own onboarding rewards"
  ON public.onboarding_rewards FOR SELECT
  USING (subject_type = 'rep' AND subject_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can view their vendor onboarding rewards" ON public.onboarding_rewards;
CREATE POLICY "Vendors can view their vendor onboarding rewards"
  ON public.onboarding_rewards FOR SELECT
  USING (subject_type = 'vendor' AND public.has_vendor_access_by_profile(subject_id));

-- 2) Rep wallet transactions table (for audit trail)
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

DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.user_wallet_transactions;
CREATE POLICY "Users can view their own wallet transactions"
  ON public.user_wallet_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Only revoke write privileges, not all (preserves SECURITY DEFINER insert capability)
REVOKE INSERT, UPDATE, DELETE ON public.user_wallet_transactions FROM anon, authenticated;
GRANT SELECT ON public.user_wallet_transactions TO authenticated;

-- 3) Index for user wallet transaction lookups
CREATE INDEX IF NOT EXISTS idx_user_wallet_tx_user_type_time
  ON public.user_wallet_transactions (user_id, txn_type, created_at DESC);

-- Conditional index for vendor_wallet_transactions (only if table exists)
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

-- 4) Rep onboarding status view (REQUIRED items only)
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
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.rep_coverage_areas rca WHERE rca.user_id = p.id) THEN 'coverage_area' END
  ], NULL) AS missing_required
) x
WHERE p.is_fieldrep = true;

-- 5) Vendor onboarding status view (REQUIRED items only)
-- FIX: vendor_coverage_areas uses user_id column, not vendor_id
-- vendor_profile.user_id is the FK to profiles, so we match on that
CREATE OR REPLACE VIEW public.vendor_onboarding_status AS
SELECT
  vp.id AS vendor_id,
  (cardinality(x.missing_required) = 0) AS is_complete,
  x.missing_required
FROM public.vendor_profile vp
CROSS JOIN LATERAL (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN vp.company_name IS NULL THEN 'company_name' END,
    CASE WHEN vp.city IS NULL OR vp.state IS NULL THEN 'location' END,
    CASE WHEN vp.primary_inspection_types IS NULL OR coalesce(array_length(vp.primary_inspection_types, 1), 0) = 0 THEN 'inspection_types' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.vendor_coverage_areas vca WHERE vca.user_id = vp.user_id) THEN 'coverage_area' END
  ], NULL) AS missing_required
) x;

-- 6) RPC: award_rep_onboarding_credits (logs to user_wallet_transactions)
CREATE OR REPLACE FUNCTION public.award_rep_onboarding_credits()
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
  FROM public.rep_onboarding_status
  WHERE rep_user_id = v_user_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Rep onboarding status not found');
  END IF;

  IF NOT v_status.is_complete THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Required onboarding items not complete', 'missing_required', v_status.missing_required);
  END IF;

  -- Idempotent insert
  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded, awarded_by)
  VALUES ('rep', v_user_id, 'onboarding_complete_v1', 5, v_user_id)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Reward already applied');
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.user_wallet (user_id, credits)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update balance
  UPDATE public.user_wallet
  SET credits = credits + 5, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING credits INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.user_wallet_transactions (user_id, actor_user_id, txn_type, delta, metadata)
  VALUES (
    v_user_id,
    v_user_id,
    'reward_onboarding',
    5,
    jsonb_build_object(
      'reward_key', 'onboarding_complete_v1',
      'subject_type', 'rep',
      'subject_id', v_user_id,
      'missing_required_at_award', v_status.missing_required
    )
  );

  RETURN jsonb_build_object('awarded', true, 'credits_awarded', 5, 'new_balance', v_new_balance, 'message', 'Onboarding reward applied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_rep_onboarding_credits() TO authenticated;

-- 7) RPC: award_vendor_onboarding_credits (logs to vendor_wallet_transactions)
CREATE OR REPLACE FUNCTION public.award_vendor_onboarding_credits(p_vendor_id uuid)
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

  IF NOT public.has_vendor_access_by_profile(p_vendor_id) THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'No access to this vendor');
  END IF;

  SELECT * INTO v_status
  FROM public.vendor_onboarding_status
  WHERE vendor_id = p_vendor_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Vendor onboarding status not found');
  END IF;

  IF NOT v_status.is_complete THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Required onboarding items not complete', 'missing_required', v_status.missing_required);
  END IF;

  -- Idempotent insert
  INSERT INTO public.onboarding_rewards (subject_type, subject_id, reward_key, credits_awarded, awarded_by)
  VALUES ('vendor', p_vendor_id, 'onboarding_complete_v1', 5, v_user_id)
  ON CONFLICT (subject_type, subject_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'credits_awarded', 0, 'message', 'Reward already applied');
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.vendor_wallet (vendor_id, credits_balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  -- Update balance
  UPDATE public.vendor_wallet
  SET credits_balance = credits_balance + 5, updated_at = now()
  WHERE vendor_id = p_vendor_id
  RETURNING credits_balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.vendor_wallet_transactions (vendor_id, actor_user_id, txn_type, delta, metadata)
  VALUES (
    p_vendor_id,
    v_user_id,
    'reward_onboarding',
    5,
    jsonb_build_object(
      'reward_key', 'onboarding_complete_v1',
      'subject_type', 'vendor',
      'subject_id', p_vendor_id,
      'missing_required_at_award', v_status.missing_required
    )
  );

  RETURN jsonb_build_object('awarded', true, 'credits_awarded', 5, 'new_balance', v_new_balance, 'message', 'Onboarding reward applied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_vendor_onboarding_credits(uuid) TO authenticated;