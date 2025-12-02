-- Create vendor credit transactions table for logging credit usage
CREATE TABLE IF NOT EXISTS public.vendor_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  amount integer NOT NULL, -- positive = credit added, negative = credit used
  action text NOT NULL,    -- e.g., 'purchase', 'post_seeking_coverage', 'unlock_contact', etc.
  metadata jsonb           -- optional: store post_id, rep_id, etc.
);

-- Enable RLS
ALTER TABLE public.vendor_credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: Vendors can only see their own credit transactions
CREATE POLICY "Vendors can see own credit transactions"
ON public.vendor_credit_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can insert transactions
CREATE POLICY "System can insert credit transactions"
ON public.vendor_credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_vendor_credit_transactions_user ON public.vendor_credit_transactions(user_id, created_at DESC);

-- Add helpful comment
COMMENT ON TABLE public.vendor_credit_transactions IS 'Logs all credit transactions for vendors. Positive amounts = credits added, negative = credits used.';