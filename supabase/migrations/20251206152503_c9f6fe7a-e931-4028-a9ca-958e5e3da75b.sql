-- Add working_terms JSONB column to vendor_rep_agreements table
-- This stores: inspection_types_covered, typical_rate, target_turnaround_days, additional_expectations
ALTER TABLE public.vendor_rep_agreements 
ADD COLUMN IF NOT EXISTS working_terms JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.vendor_rep_agreements.working_terms IS 
'JSON object containing: inspection_types_covered (string[]), typical_rate (number), target_turnaround_days (number), additional_expectations (string). Informational only - not a contract.';