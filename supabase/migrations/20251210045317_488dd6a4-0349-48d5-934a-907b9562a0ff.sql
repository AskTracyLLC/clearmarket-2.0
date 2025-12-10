-- Add active_role column to profiles for hybrid users
-- This stores which role the user is currently "acting as"
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS active_role text DEFAULT NULL;

-- Add a check constraint to ensure valid values
-- NULL means single-role user (determined by is_fieldrep/is_vendor_admin flags)
-- 'rep' or 'vendor' for hybrid users who have explicitly chosen
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_active_role_check 
CHECK (active_role IS NULL OR active_role IN ('rep', 'vendor'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.active_role IS 'For hybrid users (both is_fieldrep and is_vendor_admin = true), stores their currently active role. NULL means determined by single role flag.';