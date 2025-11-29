-- Add new columns to vendor_coverage_areas for exclusion/inclusion model
ALTER TABLE public.vendor_coverage_areas
ADD COLUMN IF NOT EXISTS coverage_mode text
  CHECK (coverage_mode IN ('entire_state', 'entire_state_except', 'selected_counties'))
  DEFAULT 'entire_state';

ALTER TABLE public.vendor_coverage_areas
ADD COLUMN IF NOT EXISTS excluded_county_ids uuid[];

ALTER TABLE public.vendor_coverage_areas
ADD COLUMN IF NOT EXISTS included_county_ids uuid[];

COMMENT ON COLUMN public.vendor_coverage_areas.coverage_mode IS
  'entire_state = all counties; entire_state_except = all except excluded_county_ids; selected_counties = only included_county_ids.';

-- Backfill existing rows
-- If covers_entire_state was true → coverage_mode = 'entire_state'
-- If county_id was set → coverage_mode = 'selected_counties' with that county in included_county_ids
UPDATE public.vendor_coverage_areas
SET coverage_mode = 'entire_state'
WHERE coverage_mode IS NULL AND covers_entire_state = true;

UPDATE public.vendor_coverage_areas
SET 
  coverage_mode = 'selected_counties',
  included_county_ids = ARRAY[county_id]
WHERE coverage_mode IS NULL AND county_id IS NOT NULL;

-- Default remaining nulls to 'entire_state'
UPDATE public.vendor_coverage_areas
SET coverage_mode = 'entire_state'
WHERE coverage_mode IS NULL;