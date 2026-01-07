-- Add email idempotency columns to pending_credit_purchases
ALTER TABLE public.pending_credit_purchases 
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS confirmation_email_id text;