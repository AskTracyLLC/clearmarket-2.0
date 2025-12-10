-- Add inspection_type_ids column to seeking_coverage_posts for detailed inspection type matching
-- This allows vendors to specify exact inspection types needed, which will be matched against
-- rep coverage area inspection types

ALTER TABLE public.seeking_coverage_posts 
ADD COLUMN IF NOT EXISTS inspection_type_ids text[] DEFAULT NULL;

-- Add index for better query performance when filtering by inspection types
CREATE INDEX IF NOT EXISTS idx_seeking_coverage_posts_inspection_type_ids 
ON public.seeking_coverage_posts USING GIN (inspection_type_ids);

COMMENT ON COLUMN public.seeking_coverage_posts.inspection_type_ids IS 
'Array of detailed inspection type labels that this post requires. NULL or empty means any inspection type is acceptable.';