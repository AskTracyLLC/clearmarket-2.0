-- Add parent_comment_id column to support nested comments (2 levels max)
ALTER TABLE public.community_comments 
ADD COLUMN parent_comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE;

-- Index for faster nested comment queries
CREATE INDEX idx_community_comments_parent ON public.community_comments(parent_comment_id);

-- Comment: Nesting is enforced in application code (2 levels max)