-- Add invite token fields to vendor_staff for secure invite links
ALTER TABLE public.vendor_staff
ADD COLUMN IF NOT EXISTS invite_token_hash text,
ADD COLUMN IF NOT EXISTS invite_token_expires_at timestamptz;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_vendor_staff_invite_token_hash ON public.vendor_staff(invite_token_hash) WHERE invite_token_hash IS NOT NULL;