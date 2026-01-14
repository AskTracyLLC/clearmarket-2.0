-- Add vendor staff role flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_vendor_staff boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_vendor_staff IS 'True if user is a vendor staff member (not owner/admin)';