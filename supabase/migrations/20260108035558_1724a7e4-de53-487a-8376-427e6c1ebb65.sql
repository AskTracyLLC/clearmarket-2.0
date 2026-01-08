-- 1) Add region_key if missing
ALTER TABLE public.vendor_client_proposal_lines
ADD COLUMN IF NOT EXISTS region_key text;

-- 2) Backfill
UPDATE public.vendor_client_proposal_lines
SET region_key = CASE
  WHEN is_all_counties = true THEN '__ALL__'
  WHEN county_id IS NOT NULL THEN county_id::text
  ELSE COALESCE(county_name, '__UNKNOWN__')
END
WHERE region_key IS NULL OR region_key = '';

-- 3) Make it required
ALTER TABLE public.vendor_client_proposal_lines
ALTER COLUMN region_key SET NOT NULL;

-- 4) Create the unique index that your UPSERT expects
CREATE UNIQUE INDEX IF NOT EXISTS vendor_proposal_lines_region_uniq
ON public.vendor_client_proposal_lines (proposal_id, state_code, order_type, region_key);

-- 5) (Optional) Drop old indexes that are now obsolete
DROP INDEX IF EXISTS public.vendor_proposal_lines_all_counties_uniq;
DROP INDEX IF EXISTS public.vendor_proposal_lines_county_uniq;