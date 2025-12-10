-- Add coverage_mode column to rep_coverage_areas table
-- Values: 'entire_state', 'entire_state_except', 'selected_counties'
ALTER TABLE public.rep_coverage_areas 
ADD COLUMN coverage_mode text DEFAULT 'selected_counties';

-- Add check constraint for valid coverage_mode values
ALTER TABLE public.rep_coverage_areas 
ADD CONSTRAINT rep_coverage_areas_coverage_mode_check 
CHECK (coverage_mode IN ('entire_state', 'entire_state_except', 'selected_counties'));

-- Backfill existing rows: if covers_entire_state = true, set coverage_mode = 'entire_state'
UPDATE public.rep_coverage_areas 
SET coverage_mode = 'entire_state' 
WHERE covers_entire_state = true;

-- Update remaining rows to 'selected_counties' (already default but explicit)
UPDATE public.rep_coverage_areas 
SET coverage_mode = 'selected_counties' 
WHERE covers_entire_state = false OR covers_entire_state IS NULL;