
BEGIN;

-- Add override columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_trust_score_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_community_score_override boolean NOT NULL DEFAULT false;

-- Admin RPC to set score visibility overrides
DROP FUNCTION IF EXISTS public.admin_set_profile_score_overrides(uuid, boolean, boolean);

CREATE OR REPLACE FUNCTION public.admin_set_profile_score_overrides(
  p_profile_id uuid,
  p_hide_trust boolean,
  p_hide_community boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET
    hide_trust_score_override = p_hide_trust,
    hide_community_score_override = p_hide_community
  WHERE id = p_profile_id;
END;
$$;

-- Grant to authenticated (function checks admin internally)
REVOKE ALL ON FUNCTION public.admin_set_profile_score_overrides(uuid, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_score_overrides(uuid, boolean, boolean) TO authenticated;

COMMIT;
