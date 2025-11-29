-- Add willing_to_obtain_background_check to rep_profile
ALTER TABLE public.rep_profile
ADD COLUMN IF NOT EXISTS willing_to_obtain_background_check boolean DEFAULT false;

COMMENT ON COLUMN public.rep_profile.willing_to_obtain_background_check IS
  'If true, this rep is willing to obtain a required background check even if they do not currently have one.';

-- Add allow_willing_to_obtain_background_check to seeking_coverage_posts
ALTER TABLE public.seeking_coverage_posts
ADD COLUMN IF NOT EXISTS allow_willing_to_obtain_background_check boolean DEFAULT true;

COMMENT ON COLUMN public.seeking_coverage_posts.allow_willing_to_obtain_background_check IS
  'If true, reps who do not yet have a valid background check but are marked as willing_to_obtain_background_check = true will still be shown as potential matches.';