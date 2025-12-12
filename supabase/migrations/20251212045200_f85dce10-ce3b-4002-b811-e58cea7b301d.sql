-- Add new columns for coaching feature
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS converted_to_coaching_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS converted_to_coaching_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS coaching_note TEXT;

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- Update any NULL or 'pending' status to 'published' for existing reviews
UPDATE public.reviews 
SET status = 'published' 
WHERE status IS NULL OR status = 'pending';

-- Add RLS policy for reps to update their own reviews (only status/coaching fields)
CREATE POLICY "Reps can update reviews about themselves to coaching"
ON public.reviews
FOR UPDATE
USING (auth.uid() = reviewee_id)
WITH CHECK (auth.uid() = reviewee_id);