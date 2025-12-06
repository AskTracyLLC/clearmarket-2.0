-- Create post_saves table for bookmarking posts
CREATE TABLE public.post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own saves
CREATE POLICY "Users can view their own saved posts"
ON public.post_saves
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts"
ON public.post_saves
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own posts"
ON public.post_saves
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_post_saves_user_id ON public.post_saves(user_id);
CREATE INDEX idx_post_saves_post_id ON public.post_saves(post_id);