-- =========================================================
-- 1) Add indexes for fast filtering on rep_contact_access_log
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_rep_contact_access_vendor_created
  ON public.rep_contact_access_log(vendor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rep_contact_access_metadata_gin
  ON public.rep_contact_access_log USING gin (metadata);

-- =========================================================
-- 2) Update get_actor_context_for_vendor to NEVER return null actor_code
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_actor_context_for_vendor(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_is_staff boolean := false;
  v_vendor_code text;
  v_staff_code text;
  v_role text;
  v_code text;
BEGIN
  -- Platform admin?
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.is_admin = true
  ) INTO v_is_admin;

  -- Vendor owner?
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profile vp
    WHERE vp.id = p_vendor_id AND vp.user_id = v_uid
  ) INTO v_is_owner;

  -- Vendor staff member?
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_staff vs
    WHERE vs.vendor_id = p_vendor_id
      AND vs.staff_user_id = v_uid
      AND vs.status = 'active'
  ) INTO v_is_staff;

  -- Determine role
  IF v_is_admin THEN
    v_role := 'admin';
  ELSIF v_is_owner THEN
    v_role := 'vendor_owner';
  ELSIF v_is_staff THEN
    v_role := 'vendor_staff';
  ELSE
    v_role := 'unknown';
  END IF;

  -- Pull vendor public code
  SELECT vp.vendor_public_code
  INTO v_vendor_code
  FROM public.vendor_profile vp
  WHERE vp.id = p_vendor_id;

  -- Pull staff code if applicable
  SELECT vs.staff_code
  INTO v_staff_code
  FROM public.vendor_staff vs
  WHERE vs.vendor_id = p_vendor_id
    AND vs.staff_user_id = v_uid
    AND vs.status = 'active'
  LIMIT 1;

  -- Determine actor_code with fallbacks (NEVER NULL)
  IF v_role = 'admin' THEN
    v_code := 'ADMIN';
  ELSIF v_role = 'vendor_staff' THEN
    -- Staff: prefer staff_code, fallback to vendor_code + _STAFF
    v_code := COALESCE(
      NULLIF(btrim(v_staff_code), ''),
      CASE WHEN v_vendor_code IS NOT NULL THEN v_vendor_code || '_STAFF' ELSE 'STAFF' END
    );
  ELSIF v_role = 'vendor_owner' THEN
    -- Owner: use vendor_code + _OWNER suffix, fallback to OWNER
    v_code := COALESCE(
      CASE WHEN v_vendor_code IS NOT NULL THEN v_vendor_code || '_OWNER' ELSE NULL END,
      'OWNER'
    );
  ELSE
    -- Unknown role fallback
    v_code := 'UNKNOWN';
  END IF;

  RETURN jsonb_build_object(
    'actor_user_id', v_uid,
    'actor_role', v_role,
    'actor_code', v_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_actor_context_for_vendor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_actor_context_for_vendor(uuid) TO authenticated;