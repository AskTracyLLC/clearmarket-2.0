-- Create a secure RPC to set the user's onboarding role
-- Avoids client-side profile updates that trigger RLS restrictions

CREATE OR REPLACE FUNCTION public.set_onboarding_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('rep', 'vendor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Must be rep or vendor.');
  END IF;

  IF p_role = 'rep' THEN
    UPDATE public.profiles
    SET
      is_fieldrep = true,
      active_role = 'rep',
      updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET
      is_vendor_admin = true,
      active_role = 'vendor',
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'role', p_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_onboarding_role(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_onboarding_role(text) FROM anon, public;