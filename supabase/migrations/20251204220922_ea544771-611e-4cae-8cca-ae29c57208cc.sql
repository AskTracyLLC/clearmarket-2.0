-- Add staff onboarding metadata columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS staff_role text,
ADD COLUMN IF NOT EXISTS staff_invited_at timestamptz,
ADD COLUMN IF NOT EXISTS staff_invite_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS staff_invite_note text;

COMMENT ON COLUMN public.profiles.staff_role IS 'Optional staff role: admin, moderator, support. Mirrors boolean flags but easier for UX.';
COMMENT ON COLUMN public.profiles.staff_invited_at IS 'When this user was created/flagged as staff.';
COMMENT ON COLUMN public.profiles.staff_invite_sent_at IS 'When last welcome/invite email was sent.';
COMMENT ON COLUMN public.profiles.staff_invite_note IS 'Optional internal note about why/for what this staff member was invited.';