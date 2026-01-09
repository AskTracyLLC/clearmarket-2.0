-- =========================================================
-- Helper functions for authorization checks
-- =========================================================

-- Platform admin check (alias for is_admin_user)
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
    AND is_admin = true
  );
$$;

-- Check if user is owner of a vendor
CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profile
    WHERE id = p_vendor_id
    AND user_id = p_user_id
  );
$$;

-- Check if user is admin staff for a vendor
CREATE OR REPLACE FUNCTION public.is_vendor_staff_admin(p_vendor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_staff
    WHERE vendor_id = p_vendor_id
    AND staff_user_id = p_user_id
    AND role = 'admin'
    AND status = 'active'
  );
$$;

-- =========================================================
-- 1) Abuse detection RPC (ADMIN ONLY)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_contact_access_abuse_flags()
RETURNS TABLE (
  vendor_user_id uuid,
  vendor_code text,
  total_accesses_24h bigint,
  unique_reps_24h bigint,
  export_count_24h bigint,
  accesses_last_hour bigint,
  flag_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Admin only
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH vendor_stats AS (
    SELECT
      l.vendor_user_id AS v_user_id,
      COUNT(*) AS total_24h,
      COUNT(DISTINCT l.rep_user_id) AS unique_reps,
      COUNT(*) FILTER (WHERE l.access_type = 'export_contact') AS exports,
      COUNT(*) FILTER (WHERE l.created_at > now() - interval '1 hour') AS hourly
    FROM public.rep_contact_access_log l
    WHERE l.created_at > now() - interval '24 hours'
    GROUP BY l.vendor_user_id
  )
  SELECT
    vs.v_user_id,
    COALESCE(vp.vendor_public_code, 'UNKNOWN')::text AS vendor_code,
    vs.total_24h AS total_accesses_24h,
    vs.unique_reps AS unique_reps_24h,
    vs.exports AS export_count_24h,
    vs.hourly AS accesses_last_hour,
    CASE
      WHEN vs.exports > 50 THEN 'HIGH_EXPORT_VOLUME'
      WHEN vs.unique_reps > 100 THEN 'MANY_UNIQUE_REPS'
      WHEN vs.hourly > 30 THEN 'HIGH_HOURLY_RATE'
      WHEN vs.total_24h > 200 THEN 'HIGH_DAILY_VOLUME'
      ELSE NULL
    END::text AS flag_reason
  FROM vendor_stats vs
  LEFT JOIN public.vendor_profile vp ON vp.user_id = vs.v_user_id
  WHERE
    vs.exports > 50
    OR vs.unique_reps > 100
    OR vs.hourly > 30
    OR vs.total_24h > 200
  ORDER BY vs.total_24h DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_access_abuse_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_access_abuse_flags() TO authenticated;

-- =========================================================
-- 2) Vendor staff action logging (secure, no spoofing)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_vendor_staff_action(
  p_vendor_id uuid,
  p_action_type text,
  p_target_staff_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_context jsonb;
  v_target_staff record;
  v_action_summary text;
BEGIN
  -- Require authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  -- Require vendor owner/admin-staff OR platform admin
  IF NOT (
    public.is_platform_admin(v_uid)
    OR public.is_vendor_owner(p_vendor_id, v_uid)
    OR public.is_vendor_staff_admin(p_vendor_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized for vendor';
  END IF;

  -- Get actor context (trusted)
  v_actor_context := public.get_actor_context_for_vendor(p_vendor_id);

  -- Target staff MUST belong to this vendor
  SELECT staff_code, invited_name, role, status, staff_user_id
    INTO v_target_staff
  FROM public.vendor_staff
  WHERE id = p_target_staff_id
    AND vendor_id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target staff not found for this vendor';
  END IF;

  -- Build action summary
  CASE p_action_type
    WHEN 'vendor_staff.invited' THEN
      v_action_summary := 'Invited staff member: ' || COALESCE(v_target_staff.invited_name, 'Unknown');
    WHEN 'vendor_staff.role_changed' THEN
      v_action_summary := 'Changed role for ' || COALESCE(v_target_staff.staff_code, 'staff') ||
                          ' from ' || COALESCE(p_details->>'from_role', '?') ||
                          ' to ' || COALESCE(p_details->>'to_role', '?');
    WHEN 'vendor_staff.disabled' THEN
      v_action_summary := 'Disabled staff member: ' || COALESCE(v_target_staff.staff_code, v_target_staff.invited_name);
    WHEN 'vendor_staff.enabled' THEN
      v_action_summary := 'Re-enabled staff member: ' || COALESCE(v_target_staff.staff_code, v_target_staff.invited_name);
    ELSE
      v_action_summary := p_action_type || ' on ' || COALESCE(v_target_staff.staff_code, 'staff');
  END CASE;

  -- Insert into admin_audit_log (actor_user_id is ALWAYS auth.uid())
  INSERT INTO public.admin_audit_log (
    actor_user_id,
    target_user_id,
    action_type,
    action_summary,
    action_details,
    source_page,
    actor_role,
    actor_code
  ) VALUES (
    v_uid,
    v_target_staff.staff_user_id,
    p_action_type,
    v_action_summary,
    jsonb_build_object(
      'vendor_id', p_vendor_id,
      'target_staff_id', p_target_staff_id,
      'target_staff_code', v_target_staff.staff_code,
      'target_staff_name', v_target_staff.invited_name
    ) || COALESCE(p_details, '{}'::jsonb),
    '/vendor/staff',
    v_actor_context->>'actor_role',
    v_actor_context->>'actor_code'
  );

  RETURN jsonb_build_object('success', true, 'summary', v_action_summary);
END;
$$;

REVOKE ALL ON FUNCTION public.log_vendor_staff_action(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_vendor_staff_action(uuid, text, uuid, jsonb) TO authenticated;