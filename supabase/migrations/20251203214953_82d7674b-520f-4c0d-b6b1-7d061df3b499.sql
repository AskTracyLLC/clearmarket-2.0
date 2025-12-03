-- Add account status for soft deactivation
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_account_status_valid
CHECK (account_status IN ('active', 'deactivated', 'suspended'));

-- Optional metadata
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_reason text;

COMMENT ON COLUMN public.profiles.account_status IS
  'Account lifecycle: active, deactivated, or suspended (soft lock, no login).';
COMMENT ON COLUMN public.profiles.deactivated_at IS
  'When the account was deactivated/suspended.';
COMMENT ON COLUMN public.profiles.deactivated_reason IS
  'Admin notes for why this account was deactivated/suspended.';