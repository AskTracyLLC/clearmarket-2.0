-- Drop existing policy and recreate with status check
DROP POLICY IF EXISTS broadcasts_select_admin_or_recipient ON public.admin_broadcasts;

CREATE POLICY broadcasts_select_admin_or_recipient
ON public.admin_broadcasts
FOR SELECT
USING (
  is_admin_user(auth.uid())
  OR (
    status IN ('sending','sent','archived')
    AND EXISTS (
      SELECT 1
      FROM public.admin_broadcast_recipients r
      WHERE r.broadcast_id = admin_broadcasts.id
        AND r.user_id = auth.uid()
    )
  )
);