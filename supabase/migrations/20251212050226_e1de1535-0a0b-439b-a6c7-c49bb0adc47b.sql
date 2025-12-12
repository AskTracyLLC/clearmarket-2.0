-- Add workflow status columns for Accept/Dispute flow
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS dispute_reason text,
ADD COLUMN IF NOT EXISTS dispute_note text,
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS disputed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_spotlighted boolean DEFAULT false;

-- Create index for workflow_status filtering
CREATE INDEX IF NOT EXISTS idx_reviews_workflow_status ON public.reviews(workflow_status);

-- Update existing reviews to have 'accepted' workflow_status (they were counted before this feature)
UPDATE public.reviews SET workflow_status = 'accepted' WHERE workflow_status IS NULL OR workflow_status = 'pending';

-- Add RLS policy for reps to update their own reviews (accept/dispute)
CREATE POLICY "Reps can accept or dispute reviews about themselves"
ON public.reviews
FOR UPDATE
USING (
  auth.uid() = reviewee_id 
  AND direction = 'vendor_to_rep'
)
WITH CHECK (
  auth.uid() = reviewee_id 
  AND direction = 'vendor_to_rep'
);