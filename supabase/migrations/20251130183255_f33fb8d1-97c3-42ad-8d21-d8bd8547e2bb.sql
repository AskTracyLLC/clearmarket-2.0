-- Drop the existing update policy that allows both vendor and field rep
DROP POLICY IF EXISTS "Participants can update vendor connections" ON public.vendor_connections;

-- Create new policy: only field reps can update vendor connections (accept/decline)
CREATE POLICY "Field reps can update vendor connections"
  ON public.vendor_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = field_rep_id)
  WITH CHECK (auth.uid() = field_rep_id);