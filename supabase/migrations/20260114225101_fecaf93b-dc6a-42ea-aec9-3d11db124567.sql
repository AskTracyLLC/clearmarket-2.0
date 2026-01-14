-- ===================
-- MESSAGES (vendor staff can send messages via conversation access)
-- ===================
DROP POLICY IF EXISTS "Vendor staff can send messages" ON public.messages;

CREATE POLICY "Vendor staff can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          public.has_vendor_access_by_owner(c.participant_one)
          OR public.has_vendor_access_by_owner(c.participant_two)
        )
    )
  );