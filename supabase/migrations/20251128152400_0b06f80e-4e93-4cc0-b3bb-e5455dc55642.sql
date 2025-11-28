-- Ensure read column has safe default and no nulls
ALTER TABLE public.messages
ALTER COLUMN read SET DEFAULT false;

UPDATE public.messages
SET read = false
WHERE read IS NULL;

-- Add RLS policy for users to mark their own received messages as read
CREATE POLICY "Users can mark own received messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);