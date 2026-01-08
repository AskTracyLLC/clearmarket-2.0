-- ============================================================
-- Fix security definer views (Postgres 15+)
-- ============================================================
ALTER VIEW public.public_vendor_gl_badges SET (security_invoker = true);
ALTER VIEW public.public_state_network_counts SET (security_invoker = true);

-- ============================================================
-- Fix set_updated_at function: add search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix notifications RLS: block client inserts (service role bypasses)
-- ============================================================
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (false);