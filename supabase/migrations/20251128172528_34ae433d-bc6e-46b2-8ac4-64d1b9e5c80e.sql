-- Add UPDATE policies for connection_notes so users can edit their own notes

CREATE POLICY "Vendors can update own connection notes"
ON public.connection_notes
FOR UPDATE
TO authenticated
USING (side = 'vendor' AND auth.uid() = vendor_id)
WITH CHECK (side = 'vendor' AND auth.uid() = vendor_id);

CREATE POLICY "Reps can update own connection notes"
ON public.connection_notes
FOR UPDATE
TO authenticated
USING (side = 'rep' AND auth.uid() = rep_id)
WITH CHECK (side = 'rep' AND auth.uid() = rep_id);