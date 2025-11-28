-- Add new columns to connection_reviews table for enhanced review system
ALTER TABLE public.connection_reviews
ADD COLUMN IF NOT EXISTS rep_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS vendor_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reviewer_role text CHECK (reviewer_role IN ('vendor', 'rep')),
ADD COLUMN IF NOT EXISTS rating_on_time integer CHECK (rating_on_time BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS rating_quality integer CHECK (rating_quality BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS rating_communication integer CHECK (rating_communication BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS summary_comment text,
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;

-- Backfill rep_user_id and vendor_user_id from existing data if needed
-- This handles any existing reviews by deriving the user IDs from rep_interest
UPDATE public.connection_reviews cr
SET 
  rep_user_id = rp.user_id,
  vendor_user_id = scp.vendor_id,
  reviewer_role = CASE 
    WHEN cr.reviewer_id = rp.user_id THEN 'rep'
    WHEN cr.reviewer_id = scp.vendor_id THEN 'vendor'
    ELSE NULL
  END,
  rating_on_time = cr.on_time_rating,
  rating_quality = cr.quality_rating,
  rating_communication = cr.communication_rating,
  summary_comment = cr.notes
FROM public.rep_interest ri
JOIN public.rep_profile rp ON ri.rep_id = rp.id
JOIN public.seeking_coverage_posts scp ON ri.post_id = scp.id
WHERE cr.rep_interest_id = ri.id
  AND cr.rep_user_id IS NULL;

-- Make new columns non-nullable after backfill
ALTER TABLE public.connection_reviews
ALTER COLUMN rep_user_id SET NOT NULL,
ALTER COLUMN vendor_user_id SET NOT NULL,
ALTER COLUMN reviewer_role SET NOT NULL;

-- Add unique constraint for one review per reviewer per connection
ALTER TABLE public.connection_reviews
DROP CONSTRAINT IF EXISTS connection_reviews_unique_per_side;

ALTER TABLE public.connection_reviews
ADD CONSTRAINT connection_reviews_unique_per_side
UNIQUE (rep_interest_id, reviewer_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.connection_reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.connection_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.connection_reviews;

-- View reviews where current user is rep or vendor on that connection
CREATE POLICY "Users can view connection reviews they are part of"
ON public.connection_reviews
FOR SELECT
TO authenticated
USING (
  auth.uid() = rep_user_id
  OR auth.uid() = vendor_user_id
);

-- Insert: only the reviewer can create a review, and they must be one of the two parties
CREATE POLICY "Users can create their own connection reviews"
ON public.connection_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND (auth.uid() = rep_user_id OR auth.uid() = vendor_user_id)
);

-- Update: only the reviewer can edit their own review
CREATE POLICY "Users can update their own connection reviews"
ON public.connection_reviews
FOR UPDATE
TO authenticated
USING (
  auth.uid() = reviewer_id
)
WITH CHECK (
  auth.uid() = reviewer_id
);

COMMENT ON TABLE public.connection_reviews IS 'Reviews between vendors and reps tied to a rep_interest connection.';
COMMENT ON COLUMN public.connection_reviews.rep_user_id IS 'User ID of the field rep being reviewed.';
COMMENT ON COLUMN public.connection_reviews.vendor_user_id IS 'User ID of the vendor being reviewed.';
COMMENT ON COLUMN public.connection_reviews.reviewer_role IS 'vendor = vendor reviewing rep, rep = rep reviewing vendor.';
COMMENT ON COLUMN public.connection_reviews.source IS 'disconnect = exit review, post_connection/manual = user-initiated.';
COMMENT ON COLUMN public.connection_reviews.is_public IS 'Whether this review can be factored into public scores.';
COMMENT ON COLUMN public.connection_reviews.is_flagged IS 'Soft flag for future moderation.';