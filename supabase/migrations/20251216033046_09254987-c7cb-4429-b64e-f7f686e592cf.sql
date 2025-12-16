-- Add rate override tracking columns to territory_assignments
ALTER TABLE public.territory_assignments
  ADD COLUMN IF NOT EXISTS rate_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate_override_reason text,
  ADD COLUMN IF NOT EXISTS rate_override_at timestamptz;