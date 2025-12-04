-- Drop existing admin policies that have self-referential checks
DROP POLICY IF EXISTS "Admins can view all rep profiles" ON public.rep_profile;
DROP POLICY IF EXISTS "Admins can view all vendor profiles" ON public.vendor_profile;
DROP POLICY IF EXISTS "Admins can view all user wallets" ON public.user_wallet;
DROP POLICY IF EXISTS "Admins can view all credit transactions" ON public.vendor_credit_transactions;

-- Recreate policies using the security definer function
CREATE POLICY "Staff can view all rep profiles"
ON public.rep_profile
FOR SELECT
TO authenticated
USING (public.is_staff_user(auth.uid()));

CREATE POLICY "Staff can view all vendor profiles"
ON public.vendor_profile
FOR SELECT
TO authenticated
USING (public.is_staff_user(auth.uid()));

CREATE POLICY "Staff can view all user wallets"
ON public.user_wallet
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_staff_user(auth.uid()));

CREATE POLICY "Staff can view all credit transactions"
ON public.vendor_credit_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_staff_user(auth.uid()));