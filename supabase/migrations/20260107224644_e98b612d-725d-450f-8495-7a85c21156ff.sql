-- Add purchase context columns to pending_credit_purchases
ALTER TABLE public.pending_credit_purchases 
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS amount_cents integer,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd';