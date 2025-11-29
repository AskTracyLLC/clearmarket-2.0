-- Add post_title_snapshot to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS post_title_snapshot text;

COMMENT ON COLUMN public.conversations.post_title_snapshot IS
  'Snapshot of the Seeking Coverage post title at the moment this conversation was created. Preserves the title even if the post is later closed or edited.';

-- Backfill existing conversations with current post titles
UPDATE public.conversations
SET post_title_snapshot = seeking_coverage_posts.title
FROM seeking_coverage_posts
WHERE conversations.origin_post_id = seeking_coverage_posts.id
  AND conversations.post_title_snapshot IS NULL
  AND conversations.origin_type = 'seeking_coverage';