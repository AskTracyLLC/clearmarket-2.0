-- Table to log Stripe webhook health (latest event received)
CREATE TABLE public.stripe_webhook_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_id text NOT NULL UNIQUE,
  livemode boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_webhook_health ENABLE ROW LEVEL SECURITY;

-- Only admins can read this table
CREATE POLICY "Admins can read webhook health"
  ON public.stripe_webhook_health
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Index for quick latest lookup
CREATE INDEX idx_stripe_webhook_health_received_at ON public.stripe_webhook_health(received_at DESC);