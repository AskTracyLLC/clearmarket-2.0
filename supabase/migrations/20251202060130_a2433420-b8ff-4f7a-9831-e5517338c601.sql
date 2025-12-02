-- Add last_seen_at column to profiles for activity tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.last_seen_at IS
  'Last time this user was active in ClearMarket (used for activity indicators and filters).';