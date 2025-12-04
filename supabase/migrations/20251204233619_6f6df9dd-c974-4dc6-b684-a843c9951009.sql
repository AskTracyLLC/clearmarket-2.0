-- Allow admins to view all rep_profile records
CREATE POLICY "Admins can view all rep profiles"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.is_moderator = true OR p.is_support = true)
  )
);

-- Allow admins to view all vendor_profile records
CREATE POLICY "Admins can view all vendor profiles"
ON public.vendor_profile
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.is_moderator = true OR p.is_support = true)
  )
);

-- Allow admins to view all user_wallet records
CREATE POLICY "Admins can view all user wallets"
ON public.user_wallet
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.is_moderator = true OR p.is_support = true)
  )
);

-- Allow admins to view all vendor_credit_transactions records
CREATE POLICY "Admins can view all credit transactions"
ON public.vendor_credit_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.is_moderator = true OR p.is_support = true)
  )
);

-- Add staff_anonymous_id column for admin/staff users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS staff_anonymous_id text;

COMMENT ON COLUMN public.profiles.staff_anonymous_id IS 'Anonymous identifier for staff members (Admin#N, Moderator#N, etc.)';

-- Create sequence for admin anonymous IDs
CREATE SEQUENCE IF NOT EXISTS admin_anon_seq START WITH 1;

-- Set tracy as Admin#1
UPDATE public.profiles
SET staff_anonymous_id = 'Admin#1'
WHERE email = 'tracy@asktracyllc.com';

-- Advance the sequence past 1 since Admin#1 is now taken
SELECT setval('admin_anon_seq', 1);