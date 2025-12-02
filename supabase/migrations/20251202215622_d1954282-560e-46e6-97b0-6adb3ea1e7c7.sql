-- Create pending_credit_purchases table for tracking Stripe checkout sessions
CREATE TABLE IF NOT EXISTS public.pending_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_pack_id text NOT NULL,
  credits_to_add integer NOT NULL,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE public.pending_credit_purchases ENABLE ROW LEVEL SECURITY;

-- Strict RLS - no client access for security (only backend/admin)
CREATE POLICY "No client access to pending_credit_purchases"
ON public.pending_credit_purchases
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create index for webhook lookup
CREATE INDEX idx_pending_purchases_session ON public.pending_credit_purchases(stripe_checkout_session_id);

-- Add comment
COMMENT ON TABLE public.pending_credit_purchases IS 'Tracks Stripe checkout sessions for credit purchases. No client access - backend only.';