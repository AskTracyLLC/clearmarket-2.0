-- Admin read access to vendor wallet tables (idempotent)

ALTER TABLE public.vendor_wallet ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vendor_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view any vendor wallet" ON public.vendor_wallet;

DROP POLICY IF EXISTS "Platform admins can view any vendor transactions" ON public.vendor_wallet_transactions;

CREATE POLICY "Platform admins can view any vendor wallet"
  ON public.vendor_wallet
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

CREATE POLICY "Platform admins can view any vendor transactions"
  ON public.vendor_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );