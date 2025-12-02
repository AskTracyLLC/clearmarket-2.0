-- Create community_post_watchers table for tracking users who want updates on posts
CREATE TABLE IF NOT EXISTS public.community_post_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_post_watchers_unique UNIQUE (user_id, post_id)
);

COMMENT ON TABLE public.community_post_watchers IS 'Users who have pinged/followed a community post to be notified when moderation resolves.';

-- Enable RLS
ALTER TABLE public.community_post_watchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can see their own community post watches"
ON public.community_post_watchers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create watch entries for themselves"
ON public.community_post_watchers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post watches"
ON public.community_post_watchers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);