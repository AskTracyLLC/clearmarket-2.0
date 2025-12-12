-- Add columns to rep_vendor_contacts for tracking conversions and soft matches
ALTER TABLE public.rep_vendor_contacts 
ADD COLUMN IF NOT EXISTS is_converted_to_vendor boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_vendor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS potential_vendor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups during vendor signup matching
CREATE INDEX IF NOT EXISTS idx_rep_vendor_contacts_email_lower ON public.rep_vendor_contacts (lower(email));
CREATE INDEX IF NOT EXISTS idx_rep_vendor_contacts_potential_vendor ON public.rep_vendor_contacts (potential_vendor_profile_id) WHERE potential_vendor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rep_vendor_contacts_active_unconverted ON public.rep_vendor_contacts (is_active, is_converted_to_vendor) WHERE is_active = true AND is_converted_to_vendor = false;