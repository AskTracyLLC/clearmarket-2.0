-- Community Board Tables

-- 1) community_posts
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_anonymous_id text,
  author_role text,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  helpful_count integer NOT NULL DEFAULT 0,
  not_helpful_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.community_posts IS 'Top-level community board posts.';
COMMENT ON COLUMN public.community_posts.category IS 'Post type: question / warning / experience / info.';
COMMENT ON COLUMN public.community_posts.status IS 'Post moderation status: active, under_review, locked, archived.';

CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) community_comments
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  helpful_count integer NOT NULL DEFAULT 0,
  not_helpful_count integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.community_comments IS 'Replies/comments on community posts.';
COMMENT ON COLUMN public.community_comments.status IS 'Comment status: active, hidden, archived.';

CREATE TRIGGER update_community_comments_updated_at
  BEFORE UPDATE ON public.community_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) community_votes
CREATE TABLE IF NOT EXISTS public.community_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  vote_type text NOT NULL,
  CONSTRAINT community_votes_unique_per_user UNIQUE (user_id, target_type, target_id)
);

COMMENT ON TABLE public.community_votes IS 'Per-user helpful/not-helpful votes on posts and comments.';

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;

-- community_posts RLS
CREATE POLICY "Community posts are readable to authenticated users"
ON public.community_posts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own community posts"
ON public.community_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own community posts"
ON public.community_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id);

-- community_comments RLS
CREATE POLICY "Community comments are readable to authenticated users"
ON public.community_comments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own community comments"
ON public.community_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own community comments"
ON public.community_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id);

-- community_votes RLS
CREATE POLICY "Users can read community votes"
ON public.community_votes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create votes as themselves"
ON public.community_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
ON public.community_votes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
ON public.community_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);