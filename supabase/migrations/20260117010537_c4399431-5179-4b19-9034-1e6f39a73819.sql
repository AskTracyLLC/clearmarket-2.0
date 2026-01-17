BEGIN;

-- =====================================================
-- PART B1: rep_visibility_boosts table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rep_visibility_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  credits_spent integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT rep_visibility_boosts_status_check CHECK (status IN ('active', 'expired', 'cancelled'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rep_boosts_rep_active 
  ON public.rep_visibility_boosts (rep_user_id, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_boosts_active 
  ON public.rep_visibility_boosts (status, ends_at DESC);

-- Enable RLS
ALTER TABLE public.rep_visibility_boosts ENABLE ROW LEVEL SECURITY;

-- Lock down direct client writes (writes only via SECURITY DEFINER RPC)
REVOKE INSERT, UPDATE, DELETE ON public.rep_visibility_boosts FROM anon, authenticated;
GRANT SELECT ON public.rep_visibility_boosts TO authenticated;

-- RLS: Reps can view their own boosts
DROP POLICY IF EXISTS "Reps can view own boosts" ON public.rep_visibility_boosts;
CREATE POLICY "Reps can view own boosts"
  ON public.rep_visibility_boosts
  FOR SELECT
  USING (auth.uid() = rep_user_id);

-- =====================================================
-- PART B2: rep_active_boost_status view
-- =====================================================
DROP VIEW IF EXISTS public.rep_active_boost_status;
CREATE VIEW public.rep_active_boost_status AS
SELECT
  rep_user_id,
  true AS is_boosted,
  MAX(ends_at) AS active_ends_at,
  MAX(starts_at) AS active_starts_at
FROM public.rep_visibility_boosts
WHERE status = 'active' AND ends_at > now()
GROUP BY rep_user_id;

-- Grant select on view
GRANT SELECT ON public.rep_active_boost_status TO authenticated;

-- =====================================================
-- PART B3: purchase_rep_boost RPC
-- =====================================================
CREATE OR REPLACE FUNCTION public.purchase_rep_boost(
  p_hours integer DEFAULT 48,
  p_cost integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_balance integer;
  v_is_rep boolean;
  v_active_ends_at timestamptz;
  v_new_ends_at timestamptz;
  v_boost_id uuid;
  v_new_balance integer;
  v_metadata jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Enforce hardcoded values to prevent abuse
  IF p_hours != 48 OR p_cost != 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PARAMS');
  END IF;

  -- Check if user is a rep
  SELECT is_fieldrep INTO v_is_rep
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_is_rep IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_REP');
  END IF;

  -- Ensure wallet exists (prevents NULL balance / false insufficient credits)
  INSERT INTO public.user_wallet (user_id, credits)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Check current credit balance (row now guaranteed to exist)
  SELECT credits INTO v_current_balance
  FROM public.user_wallet
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_current_balance < p_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'error', 'INSUFFICIENT_CREDITS',
      'current_balance', COALESCE(v_current_balance, 0)
    );
  END IF;

  -- Check for existing active boost
  SELECT active_ends_at INTO v_active_ends_at
  FROM public.rep_active_boost_status
  WHERE rep_user_id = v_user_id;

  -- Calculate new ends_at
  IF v_active_ends_at IS NOT NULL THEN
    -- Extend existing boost
    v_new_ends_at := v_active_ends_at + interval '48 hours';
    v_metadata := jsonb_build_object(
      'mode', 'time_based',
      'duration_hours', 48,
      'extended', true,
      'previous_active_ends_at', v_active_ends_at
    );
  ELSE
    -- New boost
    v_new_ends_at := now() + interval '48 hours';
    v_metadata := jsonb_build_object(
      'mode', 'time_based',
      'duration_hours', 48,
      'extended', false
    );
  END IF;

  -- Insert new boost record
  INSERT INTO public.rep_visibility_boosts (
    rep_user_id,
    starts_at,
    ends_at,
    credits_spent,
    created_by,
    metadata
  ) VALUES (
    v_user_id,
    now(),
    v_new_ends_at,
    p_cost,
    v_user_id,
    v_metadata
  )
  RETURNING id INTO v_boost_id;

  -- Deduct credits
  UPDATE public.user_wallet
  SET credits = credits - p_cost, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING credits INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.user_wallet_transactions (
    user_id,
    actor_user_id,
    txn_type,
    delta,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    v_user_id,
    'spend_boost_visibility',
    -p_cost,
    jsonb_build_object(
      'boost_id', v_boost_id,
      'ends_at', v_new_ends_at,
      'duration_hours', 48
    ),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'boost_id', v_boost_id,
    'new_balance', v_new_balance,
    'ends_at', v_new_ends_at,
    'extended', v_active_ends_at IS NOT NULL
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.purchase_rep_boost(integer, integer) TO authenticated;

COMMIT;