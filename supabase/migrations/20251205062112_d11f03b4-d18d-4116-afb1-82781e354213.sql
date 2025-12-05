-- Add shareable profile columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS share_profile_slug text,
ADD COLUMN IF NOT EXISTS share_profile_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS share_profile_last_generated_at timestamptz;

-- Add unique constraint on share_profile_slug (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_share_profile_slug_unique 
ON public.profiles (share_profile_slug) 
WHERE share_profile_slug IS NOT NULL;