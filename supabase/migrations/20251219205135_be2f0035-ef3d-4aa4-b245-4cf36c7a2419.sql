-- Allow recipients to read the broadcast they were sent
CREATE POLICY broadcasts_select_admin_or_recipient
ON public.admin_broadcasts
FOR SELECT
USING (
  is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.admin_broadcast_recipients r
    WHERE r.broadcast_id = admin_broadcasts.id
      AND r.user_id = auth.uid()
  )
);