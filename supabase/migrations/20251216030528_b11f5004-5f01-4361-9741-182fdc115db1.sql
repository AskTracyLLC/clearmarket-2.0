
-- Drop the existing restrictive rep update policy
DROP POLICY IF EXISTS "Reps can update assignments pending their confirmation" ON public.territory_assignments;

-- Create a new policy that allows reps to update their pending assignments
-- USING: rep can update if it's their assignment AND status is pending_rep
-- WITH CHECK: allows the update to result in status being 'active' or 'declined'
CREATE POLICY "Reps can update their pending assignments"
  ON public.territory_assignments
  FOR UPDATE
  USING (auth.uid() = rep_id AND status = 'pending_rep'::text)
  WITH CHECK (auth.uid() = rep_id AND status IN ('active', 'declined'));
