-- Clear legacy inspection type values from profiles
-- This migration removes old broad-category inspection types that were used before 
-- the new categorized inspection_type_options system was implemented.
-- Valid values from the new system (labels matching inspection_type_options.label) are preserved.
-- Users will need to reselect their inspection types using the new categorized options.

-- List of valid labels from inspection_type_options table (as of this migration):
-- 'BPO (Broker Price Opinion)', 'Commercial Property', 'Condition Report', 'Disaster Inspections',
-- 'Draw Inspection', 'Full Interior/Exterior', 'Insurance Claim Inspection', 'Loss Draft',
-- 'Multi-Family', 'Mystery Shopper', 'Notary Services', 'Other', 'Property Preservation', 'Standard Exterior Occupancy'

-- Create a temporary function to filter inspection types to only valid new values
CREATE OR REPLACE FUNCTION temp_filter_inspection_types(types text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    array_agg(t ORDER BY t),
    '{}'::text[]
  )
  FROM unnest(types) AS t
  WHERE t IN (
    SELECT label FROM inspection_type_options WHERE is_active = true
  )
$$;

-- Update rep_profile: keep only valid new inspection type labels
UPDATE rep_profile
SET inspection_types = temp_filter_inspection_types(inspection_types)
WHERE inspection_types IS NOT NULL 
  AND array_length(inspection_types, 1) > 0;

-- Update vendor_profile: keep only valid new inspection type labels  
UPDATE vendor_profile
SET primary_inspection_types = temp_filter_inspection_types(primary_inspection_types)
WHERE primary_inspection_types IS NOT NULL
  AND array_length(primary_inspection_types, 1) > 0;

-- Clean up the temporary function
DROP FUNCTION temp_filter_inspection_types(text[]);

-- Add a comment to document this migration
COMMENT ON COLUMN rep_profile.inspection_types IS 'Inspection type labels from inspection_type_options table. Legacy broad-category values cleared Dec 2025.';
COMMENT ON COLUMN vendor_profile.primary_inspection_types IS 'Inspection type labels from inspection_type_options table. Legacy broad-category values cleared Dec 2025.';