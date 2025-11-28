-- Create connection_reviews table for Exit Reviews and future scheduled reviews
CREATE TABLE public.connection_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_interest_id uuid NOT NULL REFERENCES public.rep_interest(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.seeking_coverage_posts(id) ON DELETE SET NULL,
  on_time_rating integer CHECK (on_time_rating >= 1 AND on_time_rating <= 5),
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  communication_rating integer CHECK (communication_rating >= 1 AND communication_rating <= 5),
  notes text,
  source text NOT NULL DEFAULT 'disconnect',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_review_per_connection UNIQUE (rep_interest_id, reviewer_id)
);

-- Enable RLS
ALTER TABLE public.connection_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own reviews
CREATE POLICY "Users can insert their own reviews"
ON public.connection_reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reviewer_id);

-- Policy: Users can view reviews where they are reviewer or subject
CREATE POLICY "Users can view their own reviews"
ON public.connection_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = reviewer_id OR auth.uid() = subject_id);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
ON public.connection_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = reviewer_id)
WITH CHECK (auth.uid() = reviewer_id);

-- Add update trigger for updated_at
CREATE TRIGGER update_connection_reviews_updated_at
  BEFORE UPDATE ON public.connection_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for common queries
CREATE INDEX idx_connection_reviews_reviewer ON public.connection_reviews(reviewer_id);
CREATE INDEX idx_connection_reviews_subject ON public.connection_reviews(subject_id);
CREATE INDEX idx_connection_reviews_rep_interest ON public.connection_reviews(rep_interest_id);