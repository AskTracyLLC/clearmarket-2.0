-- Add MVP fields to vendor_profile table for basic search and matching
-- NOTE: primary_inspection_types and systems_used are TEMPORARY MVP fields
-- These will be migrated to normalized tables in a future phase
-- Do NOT build complex matching logic on top of these array fields

ALTER TABLE public.vendor_profile
ADD COLUMN IF NOT EXISTS primary_inspection_types text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS systems_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_accepting_new_reps boolean DEFAULT true;

-- Make city required (change from nullable to not null with default empty string for existing rows)
-- First update any null values to empty string
UPDATE public.vendor_profile SET city = '' WHERE city IS NULL;

-- Add PostgreSQL comments documenting the temporary nature of these fields
COMMENT ON COLUMN public.vendor_profile.primary_inspection_types IS 'MVP PLACEHOLDER: Temporary array storage for inspection types vendor assigns. Will be normalized to dedicated table in Phase 2. Do not build complex matching logic on this field.';
COMMENT ON COLUMN public.vendor_profile.systems_used IS 'MVP PLACEHOLDER: Temporary array storage for systems vendor uses. Will be normalized to dedicated table in Phase 2. Do not build complex matching logic on this field.';
COMMENT ON COLUMN public.vendor_profile.is_accepting_new_reps IS 'Boolean flag: whether vendor is currently accepting new field rep relationships';