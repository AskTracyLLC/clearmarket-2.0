-- Ensure RLS is enabled
ALTER TABLE public.vendor_profile ENABLE ROW LEVEL SECURITY;

-- Add UNIQUE constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_profile_user_id_unique'
      AND conrelid = 'public.vendor_profile'::regclass
  ) THEN
    ALTER TABLE public.vendor_profile
      ADD CONSTRAINT vendor_profile_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

-- Remove the broad policy
DROP POLICY IF EXISTS "Users can manage their own vendor profile" ON public.vendor_profile;

-- SELECT: Vendors can read their own vendor profile
DROP POLICY IF EXISTS "Vendors can view their own vendor profile" ON public.vendor_profile;
CREATE POLICY "Vendors can view their own vendor profile"
ON public.vendor_profile
FOR SELECT
USING (auth.uid() = user_id);

-- SELECT: Staff can view all vendor profiles
DROP POLICY IF EXISTS "Staff can view vendor profiles" ON public.vendor_profile;
CREATE POLICY "Staff can view vendor profiles"
ON public.vendor_profile
FOR SELECT
USING (public.is_staff_user(auth.uid()));

-- INSERT: Vendors can create ONLY their own row, ONLY as draft, decision fields NULL
DROP POLICY IF EXISTS "Vendors can create their vendor profile (draft only)" ON public.vendor_profile;
CREATE POLICY "Vendors can create their vendor profile (draft only)"
ON public.vendor_profile
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND vendor_verification_status::text = 'draft'
  AND vendor_public_code IS NULL
  AND verified_at IS NULL
  AND verified_by IS NULL
);

-- UPDATE: Vendors can edit only pre-verification, decision fields must stay NULL
DROP POLICY IF EXISTS "Vendors can edit their own vendor profile (pre-verification)" ON public.vendor_profile;
CREATE POLICY "Vendors can edit their own vendor profile (pre-verification)"
ON public.vendor_profile
FOR UPDATE
USING (
  auth.uid() = user_id
  AND vendor_verification_status::text IN ('draft','pending','needs_review')
  AND vendor_public_code IS NULL
  AND verified_at IS NULL
  AND verified_by IS NULL
)
WITH CHECK (
  auth.uid() = user_id
  AND vendor_verification_status::text IN ('draft','pending','needs_review')
  AND vendor_public_code IS NULL
  AND verified_at IS NULL
  AND verified_by IS NULL
);

-- UPDATE: Staff can update any vendor profile
DROP POLICY IF EXISTS "Staff can update vendor profiles" ON public.vendor_profile;
CREATE POLICY "Staff can update vendor profiles"
ON public.vendor_profile
FOR UPDATE
USING (public.is_staff_user(auth.uid()))
WITH CHECK (public.is_staff_user(auth.uid()));

-- DELETE: No vendor delete policy (blocked)
DROP POLICY IF EXISTS "Vendors can delete their vendor profile" ON public.vendor_profile;

-- DELETE: Staff can delete vendor profiles
DROP POLICY IF EXISTS "Staff can delete vendor profiles" ON public.vendor_profile;
CREATE POLICY "Staff can delete vendor profiles"
ON public.vendor_profile
FOR DELETE
USING (public.is_staff_user(auth.uid()));

-- Grant execute on trigger function to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_vendor_verification_to_queue() TO authenticated;