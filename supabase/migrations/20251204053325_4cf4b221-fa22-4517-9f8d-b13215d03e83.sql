-- Add is_super_admin column to profiles (is_admin, is_moderator, is_support already exist)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_super_admin IS 'True for the top-level owner account. Can manage all staff roles.';