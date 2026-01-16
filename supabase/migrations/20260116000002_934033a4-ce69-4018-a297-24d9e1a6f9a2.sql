-- ============================================================================
-- SHARED VENDOR WALLET MIGRATION
-- ============================================================================

-- 1A. Add can_spend_credits to vendor_staff
ALTER TABLE public.vendor_staff
ADD COLUMN IF NOT EXISTS can_spend_credits boolean NOT NULL DEFAULT false;

-- 1B. Add vendor_id to pending_credit_purchases
ALTER TABLE public.pending_credit_purchases
ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendor_profile(id);

-- 1C. Create vendor_wallet table
CREATE TABLE IF NOT EXISTS public.vendor_wallet (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  credits_balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_wallet ENABLE ROW LEVEL SECURITY;

-- 1D. Create vendor_wallet_transactions table
CREATE TABLE IF NOT EXISTS public.vendor_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  txn_type text NOT NULL,
  delta integer NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_wallet_transactions_vendor_created_idx 
  ON public.vendor_wallet_transactions (vendor_id, created_at DESC);

ALTER TABLE public.vendor_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 1E. RLS Policies (DROP first to prevent duplicates)
DROP POLICY IF EXISTS "Vendor members can view wallet" ON public.vendor_wallet;
DROP POLICY IF EXISTS "Vendor members can view transactions" ON public.vendor_wallet_transactions;

CREATE POLICY "Vendor members can view wallet"
  ON public.vendor_wallet FOR SELECT TO authenticated
  USING (has_vendor_access_by_profile(vendor_id));

CREATE POLICY "Vendor members can view transactions"
  ON public.vendor_wallet_transactions FOR SELECT TO authenticated
  USING (has_vendor_access_by_profile(vendor_id));

-- 1F. spend_vendor_credits Function (SECURITY DEFINER, for authenticated users)
CREATE OR REPLACE FUNCTION public.spend_vendor_credits(
  p_vendor_id uuid,
  p_amount integer,
  p_txn_type text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_can_spend boolean := false;
  v_balance integer;
  v_caller_id uuid := auth.uid();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- First: verify caller is a vendor member at all
  IF NOT has_vendor_access_by_profile(p_vendor_id) THEN
    RAISE EXCEPTION 'Not a member of this vendor';
  END IF;

  -- Check if caller is vendor owner
  IF EXISTS (
    SELECT 1 FROM vendor_profile
    WHERE id = p_vendor_id AND user_id = v_caller_id
  ) THEN
    v_can_spend := true;
  ELSE
    -- Check if caller is staff with admin/owner role or can_spend_credits permission
    SELECT (vs.role IN ('owner', 'admin') OR vs.can_spend_credits = true)
    INTO v_can_spend
    FROM vendor_staff vs
    WHERE vs.vendor_id = p_vendor_id
      AND vs.staff_user_id = v_caller_id
      AND vs.status = 'active';
  END IF;

  IF v_can_spend IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized to spend vendor credits';
  END IF;

  -- Ensure wallet exists
  INSERT INTO vendor_wallet (vendor_id, credits_balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  -- Lock and check balance
  SELECT credits_balance INTO v_balance
  FROM vendor_wallet
  WHERE vendor_id = p_vendor_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Record transaction
  INSERT INTO vendor_wallet_transactions
    (vendor_id, actor_user_id, txn_type, delta, metadata)
  VALUES (p_vendor_id, v_caller_id, p_txn_type, -p_amount, p_metadata);

  -- Update balance
  UPDATE vendor_wallet
  SET credits_balance = credits_balance - p_amount,
      updated_at = now()
  WHERE vendor_id = p_vendor_id;
END;
$$;

-- 1G. add_vendor_credits Function (SERVICE-ROLE ONLY)
CREATE OR REPLACE FUNCTION public.add_vendor_credits(
  p_vendor_id uuid,
  p_amount integer,
  p_txn_type text,
  p_actor_user_id uuid,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure wallet exists
  INSERT INTO vendor_wallet (vendor_id, credits_balance)
  VALUES (p_vendor_id, 0)
  ON CONFLICT (vendor_id) DO NOTHING;

  -- Record transaction
  INSERT INTO vendor_wallet_transactions
    (vendor_id, actor_user_id, txn_type, delta, metadata)
  VALUES (p_vendor_id, p_actor_user_id, p_txn_type, p_amount, p_metadata);

  -- Update balance
  UPDATE vendor_wallet
  SET credits_balance = credits_balance + p_amount,
      updated_at = now()
  WHERE vendor_id = p_vendor_id;
END;
$$;

-- 1H. Explicit GRANT/REVOKE with full signatures
GRANT EXECUTE ON FUNCTION public.spend_vendor_credits(uuid, integer, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.add_vendor_credits(uuid, integer, text, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_vendor_credits(uuid, integer, text, uuid, jsonb) FROM anon;

-- 1I. Idempotent Data Migration (only vendors with credits > 0)
INSERT INTO vendor_wallet (vendor_id, credits_balance, updated_at)
SELECT
  v.vendor_id,
  SUM(COALESCE(uw.credits, 0)) as total_credits,
  now()
FROM (
  -- Owner credits
  SELECT vp.id as vendor_id, vp.user_id
  FROM vendor_profile vp WHERE vp.user_id IS NOT NULL
  UNION ALL
  -- Staff credits
  SELECT vs.vendor_id, vs.staff_user_id as user_id
  FROM vendor_staff vs WHERE vs.status = 'active'
) v
LEFT JOIN user_wallet uw ON uw.user_id = v.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_wallet vw WHERE vw.vendor_id = v.vendor_id
)
GROUP BY v.vendor_id
HAVING SUM(COALESCE(uw.credits, 0)) > 0;

-- Record migration transactions (only for vendors just migrated, prevent duplicates)
INSERT INTO vendor_wallet_transactions (vendor_id, actor_user_id, txn_type, delta, metadata)
SELECT
  v.vendor_id,
  v.user_id,
  'migration_from_user_wallet',
  COALESCE(uw.credits, 0),
  jsonb_build_object('source_user_id', v.user_id, 'migrated_at', now())
FROM (
  SELECT vp.id as vendor_id, vp.user_id FROM vendor_profile vp WHERE vp.user_id IS NOT NULL
  UNION ALL
  SELECT vs.vendor_id, vs.staff_user_id FROM vendor_staff vs WHERE vs.status = 'active'
) v
LEFT JOIN user_wallet uw ON uw.user_id = v.user_id
WHERE COALESCE(uw.credits, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM vendor_wallet_transactions vwt 
    WHERE vwt.vendor_id = v.vendor_id 
      AND vwt.txn_type = 'migration_from_user_wallet'
      AND vwt.metadata->>'source_user_id' = v.user_id::text
  );