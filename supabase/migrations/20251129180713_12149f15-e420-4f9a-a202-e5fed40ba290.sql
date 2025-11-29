-- Create reviews table for mutual vendor-rep feedback
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Who is reviewing whom
  reviewer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,

  -- Tie review back to the relationship (optional but important for "verified")
  rep_interest_id uuid REFERENCES public.rep_interest (id) ON DELETE SET NULL,

  -- Direction and context
  direction text NOT NULL CHECK (direction IN ('vendor_to_rep', 'rep_to_vendor')),
  is_exit_review boolean NOT NULL DEFAULT false,

  -- Ratings – 1 to 5, nullable until submitted
  rating_on_time int CHECK (rating_on_time BETWEEN 1 AND 5),
  rating_quality int CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication int CHECK (rating_communication BETWEEN 1 AND 5),

  -- Extra info
  would_work_again boolean,
  comment text,

  -- Lifecycle / visibility
  status text NOT NULL DEFAULT 'pending_reviewee'
    CHECK (status IN ('pending_reviewee', 'published', 'disputed', 'hidden')),

  is_verified boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.reviews IS
  'Mutual review system between vendors and reps. Used for exit reviews and ongoing feedback.';
COMMENT ON COLUMN public.reviews.rep_interest_id IS
  'Links a review to a specific vendor–rep connection for verification.';
COMMENT ON COLUMN public.reviews.is_exit_review IS
  'True when the review is tied to a disconnection event.';
COMMENT ON COLUMN public.reviews.status IS
  'pending_reviewee: waiting for reviewee to see/acknowledge; published: visible publicly; disputed: reviewee disputed; hidden: admin/moderator hidden.';
COMMENT ON COLUMN public.reviews.is_verified IS
  'True when review is tied to a real connection (rep_interest row).';

-- Add updated_at trigger
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create reviews as themselves"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewers and reviewees can update their own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id)
  WITH CHECK (auth.uid() = reviewer_id OR auth.uid() = reviewee_id);

CREATE POLICY "Users can view relevant reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR auth.uid() = reviewer_id
    OR auth.uid() = reviewee_id
  );