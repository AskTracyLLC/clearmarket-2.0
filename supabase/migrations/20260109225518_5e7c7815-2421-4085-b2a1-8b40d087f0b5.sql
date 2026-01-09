-- =========================================================
-- 1) Add columns to admin_audit_log
-- =========================================================
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS actor_code text;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_role ON public.admin_audit_log(actor_role);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_code ON public.admin_audit_log(actor_code);

-- =========================================================
-- 2) Add actor attribution to rep_contact_access_log
-- =========================================================
ALTER TABLE public.rep_contact_access_log
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_rep_contact_access_actor_user ON public.rep_contact_access_log(actor_user_id);

-- =========================================================
-- 3) Helper RPC: derive actor_role + actor_code (server-side, trusted)
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

  -- Pull codes
  SELECT vp.vendor_public_code
  INTO v_vendor_code
  FROM public.vendor_profile vp
  WHERE vp.id = p_vendor_id;

  SELECT vs.staff_code
  INTO v_staff_code
  FROM public.vendor_staff vs
  WHERE vs.vendor_id = p_vendor_id
    AND vs.staff_user_id = v_uid
    AND vs.status = 'active'
  LIMIT 1;

  -- Prefer staff_code; fallback to vendor code; admins get ADMIN
  IF v_role = 'admin' THEN
    v_code := 'ADMIN';
  ELSE
    v_code := COALESCE(v_staff_code, v_vendor_code);
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