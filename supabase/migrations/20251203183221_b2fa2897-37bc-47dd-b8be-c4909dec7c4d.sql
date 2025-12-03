-- Create beta invite codes table
CREATE TABLE IF NOT EXISTS public.beta_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.beta_invite_codes IS 'Invite codes for beta / gated signup access.';

ALTER TABLE public.beta_invite_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage invite codes
CREATE POLICY "Admins can manage invite codes"
ON public.beta_invite_codes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

-- Add used_invite_code column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS used_invite_code text;

COMMENT ON COLUMN public.profiles.used_invite_code IS 'Which invite code this user used to sign up (if any).';