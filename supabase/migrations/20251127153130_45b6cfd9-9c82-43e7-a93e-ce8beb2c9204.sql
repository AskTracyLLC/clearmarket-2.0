-- Create rep_interest table to track rep interest in seeking coverage posts
CREATE TABLE IF NOT EXISTS public.rep_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.seeking_coverage_posts(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES public.rep_profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_interest_unique UNIQUE (post_id, rep_id)
);

-- Add updated_at trigger
CREATE TRIGGER update_rep_interest_updated_at
  BEFORE UPDATE ON public.rep_interest
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.rep_interest ENABLE ROW LEVEL SECURITY;

-- Reps can see their own interest rows
CREATE POLICY "Reps can view their own interest"
  ON public.rep_interest
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.rep_profile WHERE id = rep_id));

-- Reps can create their own interest
CREATE POLICY "Reps can express interest"
  ON public.rep_interest
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.rep_profile WHERE id = rep_id));

-- Vendors can see interest for their own posts
CREATE POLICY "Vendors can view interest on their posts"
  ON public.rep_interest
  FOR SELECT
  USING (auth.uid() IN (SELECT vendor_id FROM public.seeking_coverage_posts WHERE id = post_id));

-- Vendors can update interest status on their own posts
CREATE POLICY "Vendors can update interest on their posts"
  ON public.rep_interest
  FOR UPDATE
  USING (auth.uid() IN (SELECT vendor_id FROM public.seeking_coverage_posts WHERE id = post_id));

-- Add index for performance
CREATE INDEX idx_rep_interest_post_id ON public.rep_interest(post_id);
CREATE INDEX idx_rep_interest_rep_id ON public.rep_interest(rep_id);