-- Add location fields to rep_profile table
ALTER TABLE public.rep_profile
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN zip_code text;

-- Add location fields to vendor_profile table
ALTER TABLE public.vendor_profile
ADD COLUMN city text,
ADD COLUMN state text;

COMMENT ON COLUMN rep_profile.city IS 'Rep primary city (MVP field)';
COMMENT ON COLUMN rep_profile.state IS 'Rep primary state (MVP field)';
COMMENT ON COLUMN rep_profile.zip_code IS 'Rep ZIP code (MVP field)';
COMMENT ON COLUMN vendor_profile.city IS 'Vendor primary city (MVP field)';
COMMENT ON COLUMN vendor_profile.state IS 'Vendor primary state (MVP field)';