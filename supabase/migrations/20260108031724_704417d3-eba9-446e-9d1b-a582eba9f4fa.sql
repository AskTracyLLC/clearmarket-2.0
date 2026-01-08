-- Add region_key column to vendor_client_proposal_lines
ALTER TABLE public.vendor_client_proposal_lines 
ADD COLUMN region_key text;

-- Backfill existing rows:
-- For is_all_counties = true, set region_key = '__ALL__'
-- For county overrides, set region_key = county_id (or county_name as fallback)
UPDATE public.vendor_client_proposal_lines
SET region_key = CASE 
  WHEN is_all_counties = true THEN '__ALL__'
  WHEN county_id IS NOT NULL THEN county_id::text
  ELSE COALESCE(county_name, '__UNKNOWN__')
END;

-- Make region_key NOT NULL after backfill
ALTER TABLE public.vendor_client_proposal_lines
ALTER COLUMN region_key SET NOT NULL;

-- Create the new unified unique index
CREATE UNIQUE INDEX vendor_proposal_lines_region_uniq 
ON public.vendor_client_proposal_lines (proposal_id, state_code, order_type, region_key);

-- Drop the old partial unique indexes if they exist
DROP INDEX IF EXISTS public.vendor_proposal_lines_all_counties_uniq;
DROP INDEX IF EXISTS public.vendor_proposal_lines_county_uniq;