-- Allow reps to update seeking_coverage_posts when accepting territory assignments
-- They need to close posts tied to assignments they're accepting
CREATE POLICY "Reps can close posts when accepting assignments" 
ON public.seeking_coverage_posts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.territory_assignments ta
    WHERE ta.seeking_coverage_post_id = seeking_coverage_posts.id
      AND ta.rep_id = auth.uid()
      AND ta.status = 'pending_rep'
  )
);

-- Allow reps to update rep_interest records to mark others as not_selected when post is filled
-- This is needed so the system can update other interested reps when a post is filled
CREATE POLICY "System can update interest when post filled" 
ON public.rep_interest 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.seeking_coverage_posts scp
    WHERE scp.id = rep_interest.post_id
      AND scp.filled_by_rep_id = auth.uid()
  )
);