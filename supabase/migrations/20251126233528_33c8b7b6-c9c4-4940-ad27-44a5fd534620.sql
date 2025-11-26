-- Add deleted_at column for soft deletes
ALTER TABLE public.seeking_coverage_posts 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.seeking_coverage_posts.deleted_at IS 'Soft delete timestamp. NULL = active record, NOT NULL = deleted';

-- Ensure vendors can update their own posts (status, deleted_at, is_accepting_responses)
-- The existing "Vendors can manage their own posts" policy with ALL command should already cover this,
-- but let's verify the policy allows UPDATE operations for these fields