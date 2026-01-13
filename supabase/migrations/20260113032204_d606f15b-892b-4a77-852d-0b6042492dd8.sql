-- Update the protect_profiles_sensitive_columns function with strict allowlist logic
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
BEGIN
  -- Allow if onboarding RPC set the flag AND ONLY role-related fields changed
  IF current_setting('clearmarket.allow_onboarding_role_update', true) = 'true' THEN

    -- 1) Still block admin/staff/status changes
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
       OR NEW.is_support IS DISTINCT FROM OLD.is_support
       OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
       OR NEW.account_status IS DISTINCT FROM OLD.account_status
       OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
    THEN
      RAISE EXCEPTION 'You cannot modify admin/staff/status fields';
    END IF;

    -- 2) Bulletproof allowlist: ONLY these keys may change
    v_new := to_jsonb(NEW) - ARRAY['is_fieldrep','is_vendor_admin','active_role','updated_at'];
    v_old := to_jsonb(OLD) - ARRAY['is_fieldrep','is_vendor_admin','active_role','updated_at'];

    IF v_new IS DISTINCT FROM v_old THEN
      RAISE EXCEPTION 'Only role fields may be updated during onboarding';
    END IF;

    RETURN NEW;
  END IF;

  -- Original behavior: block sensitive columns for non-admins
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
     OR NEW.is_support IS DISTINCT FROM OLD.is_support
     OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.is_vendor_admin IS DISTINCT FROM OLD.is_vendor_admin
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
  THEN
    RAISE EXCEPTION 'You cannot modify admin/staff/status fields';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is properly attached (idempotent)
DROP TRIGGER IF EXISTS trg_protect_profiles_sensitive_columns ON public.profiles;

CREATE TRIGGER trg_protect_profiles_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profiles_sensitive_columns();

-- Update the RPC to set the config flag before updating
CREATE OR REPLACE FUNCTION public.set_onboarding_role(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('rep', 'vendor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Set the config flag to allow role updates through the trigger
  PERFORM set_config('clearmarket.allow_onboarding_role_update', 'true', true);

  IF p_role = 'rep' THEN
    UPDATE public.profiles
    SET is_fieldrep = TRUE,
        active_role = 'rep',
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET is_vendor_admin = TRUE,
        active_role = 'vendor',
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'role', p_role);
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.set_onboarding_role(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_onboarding_role(text) FROM anon, public;