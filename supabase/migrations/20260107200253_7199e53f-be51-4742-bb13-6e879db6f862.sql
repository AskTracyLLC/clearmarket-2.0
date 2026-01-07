-- Create table for Stripe webhook logging
CREATE TABLE public.stripe_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signature_valid BOOLEAN,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  payload_summary JSONB,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for idempotency checks
CREATE UNIQUE INDEX idx_stripe_webhook_logs_event_id ON public.stripe_webhook_logs(event_id);

-- Index for finding failed/pending logs
CREATE INDEX idx_stripe_webhook_logs_status ON public.stripe_webhook_logs(status);

-- Enable RLS (admin-only access)
ALTER TABLE public.stripe_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
ON public.stripe_webhook_logs
FOR SELECT
USING (public.is_admin_user(auth.uid()));