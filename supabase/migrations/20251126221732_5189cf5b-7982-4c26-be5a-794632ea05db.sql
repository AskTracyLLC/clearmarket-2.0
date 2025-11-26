-- Update seeking_coverage_posts table with structured MVP fields
-- Keep legacy columns for backward compatibility but add new structured fields

-- Add new structured columns for MVP
ALTER TABLE public.seeking_coverage_posts
ADD COLUMN IF NOT EXISTS state_code text,
ADD COLUMN IF NOT EXISTS county_fips text,
ADD COLUMN IF NOT EXISTS covers_entire_state boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_types text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS systems_required_array text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_accepting_responses boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_expires_at timestamptz;

-- Make state_code NOT NULL after adding (for existing rows, we'll handle separately)
-- For now, allow NULL for backward compatibility with existing data
COMMENT ON COLUMN public.seeking_coverage_posts.state_code IS 'Two-letter state abbreviation (e.g., WI, IL). New logic should use this.';
COMMENT ON COLUMN public.seeking_coverage_posts.county_fips IS 'County FIPS code from us_counties table. NULL if covers_entire_state=true.';
COMMENT ON COLUMN public.seeking_coverage_posts.covers_entire_state IS 'If true, post covers entire state; county_fips should be NULL.';
COMMENT ON COLUMN public.seeking_coverage_posts.inspection_types IS 'Array of inspection types. Matches rep_profile.inspection_types format. New logic should use this.';
COMMENT ON COLUMN public.seeking_coverage_posts.systems_required_array IS 'Array of systems required. Matches rep/vendor profile systems format. New logic should use this.';
COMMENT ON COLUMN public.seeking_coverage_posts.is_accepting_responses IS 'Whether vendor is currently accepting responses to this post.';
COMMENT ON COLUMN public.seeking_coverage_posts.auto_expires_at IS 'Automatic expiry timestamp (created_at + 30 days for MVP). Post status should flip to expired after this.';

-- Mark legacy columns
COMMENT ON COLUMN public.seeking_coverage_posts.location IS 'LEGACY: Free-text location field. Use state_code/county_fips/covers_entire_state instead.';
COMMENT ON COLUMN public.seeking_coverage_posts.inspection_type IS 'LEGACY: Single inspection type text. Use inspection_types array instead.';
COMMENT ON COLUMN public.seeking_coverage_posts.systems_required IS 'LEGACY: Systems as array but old format. Use systems_required_array instead.';

-- Update status column to have proper check constraint
ALTER TABLE public.seeking_coverage_posts
DROP CONSTRAINT IF EXISTS seeking_coverage_posts_status_check;

ALTER TABLE public.seeking_coverage_posts
ADD CONSTRAINT seeking_coverage_posts_status_check 
CHECK (status IN ('active', 'expired', 'closed'));

COMMENT ON TABLE public.seeking_coverage_posts IS 'Vendor job postings seeking field rep coverage. New logic should use state_code, county_fips, covers_entire_state, inspection_types, systems_required_array, auto_expires_at, and status. Legacy columns (location, inspection_type, systems_required) maintained for backward compatibility only.';