-- Add time-off / availability fields to rep_profile
ALTER TABLE public.rep_profile
ADD COLUMN IF NOT EXISTS unavailable_from date,
ADD COLUMN IF NOT EXISTS unavailable_to date,
ADD COLUMN IF NOT EXISTS unavailable_note text;

COMMENT ON COLUMN public.rep_profile.unavailable_from IS
  'Start date for a temporary unavailability period (inclusive).';

COMMENT ON COLUMN public.rep_profile.unavailable_to IS
  'End date for a temporary unavailability period (inclusive).';

COMMENT ON COLUMN public.rep_profile.unavailable_note IS
  'Optional note explaining the time off (e.g. vacation, surgery, limited availability).';