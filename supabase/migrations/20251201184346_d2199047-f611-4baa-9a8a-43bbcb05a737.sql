-- Add states_covered column to vendor_rep_agreements table
ALTER TABLE public.vendor_rep_agreements
ADD COLUMN states_covered text[];

COMMENT ON COLUMN public.vendor_rep_agreements.states_covered IS 'Array of state codes (e.g. IL, WI) covered by this agreement, derived from coverage areas';