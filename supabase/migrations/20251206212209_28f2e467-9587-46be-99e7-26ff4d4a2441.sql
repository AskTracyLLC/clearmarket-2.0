-- Add feedback reset fields to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS is_feedback boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS feedback_marked_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS feedback_marked_by_user_id uuid NULL;

-- Add foreign key for feedback_marked_by_user_id
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_feedback_marked_by_user_id_fkey
FOREIGN KEY (feedback_marked_by_user_id) REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- Create index for efficient feedback queries
CREATE INDEX IF NOT EXISTS idx_reviews_feedback ON public.reviews (reviewee_id, is_feedback, feedback_marked_at);

-- Update RLS policies to allow reviewees to mark reviews as feedback
-- Drop existing update policy if it exists and recreate with feedback capability
DROP POLICY IF EXISTS "Reviewers and reviewees can update their own reviews" ON public.reviews;

CREATE POLICY "Reviewers and reviewees can update their own reviews"
ON public.reviews
FOR UPDATE
USING (
  (auth.uid() = reviewer_id) OR (auth.uid() = reviewee_id)
)
WITH CHECK (
  (auth.uid() = reviewer_id) OR (auth.uid() = reviewee_id)
);