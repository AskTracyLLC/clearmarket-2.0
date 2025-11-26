-- Add MVP fields to rep_profile table for basic search and matching
-- NOTE: systems_used and inspection_types are TEMPORARY MVP fields
-- These will be migrated to normalized tables in a future phase
-- Do NOT build complex matching logic on top of these array fields

ALTER TABLE public.rep_profile
ADD COLUMN IF NOT EXISTS systems_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS inspection_types text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_accepting_new_vendors boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS willing_to_travel_out_of_state boolean DEFAULT false;

-- Add PostgreSQL comments documenting the temporary nature of these fields
COMMENT ON COLUMN public.rep_profile.systems_used IS 'MVP PLACEHOLDER: Temporary array storage for systems. Will be normalized to dedicated table in Phase 2. Do not build complex matching logic on this field.';
COMMENT ON COLUMN public.rep_profile.inspection_types IS 'MVP PLACEHOLDER: Temporary array storage for inspection types. Will be normalized to dedicated table in Phase 2. Do not build complex matching logic on this field.';
COMMENT ON COLUMN public.rep_profile.is_accepting_new_vendors IS 'Boolean flag: whether rep is currently accepting new vendor relationships';
COMMENT ON COLUMN public.rep_profile.willing_to_travel_out_of_state IS 'Boolean flag: whether rep is willing to travel outside their home state for work';