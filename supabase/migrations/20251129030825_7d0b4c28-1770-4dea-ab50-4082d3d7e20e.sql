-- Add Background Check columns to rep_profile
ALTER TABLE public.rep_profile
ADD COLUMN IF NOT EXISTS background_check_is_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS background_check_provider text CHECK (background_check_provider IN ('aspen_grove', 'other')),
ADD COLUMN IF NOT EXISTS background_check_provider_other_name text,
ADD COLUMN IF NOT EXISTS background_check_id text,
ADD COLUMN IF NOT EXISTS background_check_expires_on date,
ADD COLUMN IF NOT EXISTS background_check_screenshot_url text;

COMMENT ON COLUMN public.rep_profile.background_check_is_active IS 'Whether this rep currently has an active, valid background check for matching';
COMMENT ON COLUMN public.rep_profile.background_check_provider IS 'Background check provider: aspen_grove (AspenGrove / Shield ID) or other';
COMMENT ON COLUMN public.rep_profile.background_check_provider_other_name IS 'If provider=other, the name of the background check provider';
COMMENT ON COLUMN public.rep_profile.background_check_id IS 'Provider reference (e.g., AspenGrove ABC# / Shield ID or other ID)';
COMMENT ON COLUMN public.rep_profile.background_check_expires_on IS 'Expiration date of the background check (if known)';
COMMENT ON COLUMN public.rep_profile.background_check_screenshot_url IS 'URL to a screenshot proving a valid, passed background check';

-- Add Background Check requirement columns to seeking_coverage_posts
ALTER TABLE public.seeking_coverage_posts
ADD COLUMN IF NOT EXISTS requires_background_check boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_aspen_grove boolean DEFAULT false;

COMMENT ON COLUMN public.seeking_coverage_posts.requires_background_check IS 'If true, only reps with an active background check are eligible to match this post';
COMMENT ON COLUMN public.seeking_coverage_posts.requires_aspen_grove IS 'If true, rep must have an active AspenGrove/Shield ID background check; only used when requires_background_check is true';

-- Create storage bucket for background check screenshots if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('background-checks', 'background-checks', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for background-checks bucket
CREATE POLICY "Reps can upload their own background check screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'background-checks' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Reps can view their own background check screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'background-checks' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view background check screenshots for matching"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'background-checks' AND
  auth.role() = 'authenticated'
);