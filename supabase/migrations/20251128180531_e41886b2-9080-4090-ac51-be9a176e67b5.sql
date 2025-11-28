-- Add origin tracking columns to conversations table for Seeking Coverage context

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS origin_type text
  CHECK (origin_type IN ('seeking_coverage'))
  DEFAULT NULL;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS origin_post_id uuid
  REFERENCES public.seeking_coverage_posts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.conversations.origin_type IS
  'High-level origin for this conversation. Currently supports: seeking_coverage';

COMMENT ON COLUMN public.conversations.origin_post_id IS
  'If origin_type = seeking_coverage, this points to the original seeking_coverage_posts.id';

CREATE INDEX IF NOT EXISTS idx_conversations_origin_post_id
ON public.conversations(origin_post_id);