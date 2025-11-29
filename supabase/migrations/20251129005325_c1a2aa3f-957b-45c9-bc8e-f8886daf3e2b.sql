-- Add connected_at timestamp to rep_interest table
ALTER TABLE public.rep_interest
ADD COLUMN IF NOT EXISTS connected_at timestamptz;

COMMENT ON COLUMN public.rep_interest.connected_at IS
  'Timestamp when this rep/post relationship became connected. Used for "Connected since" display.';

-- Backfill existing connected relationships with a reasonable date
UPDATE public.rep_interest
SET connected_at = COALESCE(updated_at, created_at)
WHERE status = 'connected' AND connected_at IS NULL;