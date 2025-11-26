-- Add county_id column to seeking_coverage_posts with FK to us_counties
ALTER TABLE public.seeking_coverage_posts 
ADD COLUMN county_id uuid REFERENCES public.us_counties(id);

COMMENT ON COLUMN public.seeking_coverage_posts.county_id IS 'References us_counties.id (MVP county link)';

-- Mark county_fips as deprecated
COMMENT ON COLUMN public.seeking_coverage_posts.county_fips IS 'Deprecated: previously used to store county UUID; do not rely on this field. Use county_id instead.';

-- Migrate any existing UUID data from county_fips to county_id
UPDATE public.seeking_coverage_posts
SET county_id = county_fips::uuid
WHERE county_fips IS NOT NULL AND county_fips ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Clear county_fips for migrated rows
UPDATE public.seeking_coverage_posts
SET county_fips = NULL
WHERE county_id IS NOT NULL;