-- Drop the policy if it exists, then create it
DROP POLICY IF EXISTS "Reps can update their own interest" ON public.rep_interest;

-- Allow reps to update their own rep_interest rows (for disconnect)
CREATE POLICY "Reps can update their own interest"
ON public.rep_interest
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.rep_profile WHERE id = rep_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.rep_profile WHERE id = rep_id
  )
);