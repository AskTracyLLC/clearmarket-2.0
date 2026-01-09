-- =====================================================
-- Anti-Scraping: rep_contact_access_log + service-only rate_limit_counters + metrics RPC
-- Matches schema:
--   vendor_connections(vendor_id, field_rep_id, status enum)
--   rep_contact_unlocks(vendor_user_id, rep_user_id)
-- =====================================================

-- 1) rep_contact_access_log table
CREATE TABLE IF NOT EXISTS public.rep_contact_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rep_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_type text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_contact_access_log_access_type_check
    CHECK (access_type IN ('view_contact', 'unlock_contact', 'export_contact'))
);

ALTER TABLE public.rep_contact_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_contact_access_log FORCE ROW LEVEL SECURITY;

-- Indexes (scrape pattern detection + faster admin queries)
CREATE INDEX IF NOT EXISTS idx_rep_contact_access_log_vendor_rep_created
  ON public.rep_contact_access_log (vendor_user_id, rep_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_contact_access_log_created_at
  ON public.rep_contact_access_log (created_at DESC);

-- Lock down privileges (defense in depth) - NO SELECT for authenticated (admin-only via RPC)
REVOKE ALL ON TABLE public.rep_contact_access_log FROM anon;
REVOKE ALL ON TABLE public.rep_contact_access_log FROM PUBLIC;
REVOKE ALL ON TABLE public.rep_contact_access_log FROM authenticated;
GRANT INSERT ON public.rep_contact_access_log TO authenticated;

-- Policies (drop for rerun safety)
DROP POLICY IF EXISTS "rep_contact_access_log_admin_read" ON public.rep_contact_access_log;
DROP POLICY IF EXISTS "rep_contact_access_log_vendor_read_own" ON public.rep_contact_access_log;
DROP POLICY IF EXISTS "rep_contact_access_log_insert_own" ON public.rep_contact_access_log;

-- Admin/staff can read all logs (for admin UI if needed via service role or direct query)
CREATE POLICY "rep_contact_access_log_admin_read"
ON public.rep_contact_access_log
FOR SELECT
TO authenticated
USING (
  public.is_admin_allowlisted(auth.uid())
  OR public.is_staff_allowlisted(auth.uid())
);

-- NO vendor read policy (max anti-scrape posture)

-- Inserts only for self (called via RPC, this is a safe backstop)
CREATE POLICY "rep_contact_access_log_insert_own"
ON public.rep_contact_access_log
FOR INSERT
TO authenticated
WITH CHECK (vendor_user_id = auth.uid());

-- 2) rate_limit_counters table (SERVICE ROLE ONLY)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_type, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_user_action_window
  ON public.rate_limit_counters (user_id, action_type, window_start DESC);

REVOKE ALL ON TABLE public.rate_limit_counters FROM anon;
REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_counters FROM authenticated;

-- No policies on purpose: only service role / server-side can touch this table.

-- 3) RPC: log_rep_contact_access (validates vendor + connected/unlocked)
CREATE OR REPLACE FUNCTION public.log_rep_contact_access(
  p_rep_user_id uuid,
  p_access_type text,
  p_ip_hash text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_vendor_id uuid := auth.uid();
  v_is_vendor boolean := false;
  v_is_active boolean := false;
  v_has_access boolean := false;
BEGIN
  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_access_type NOT IN ('view_contact', 'unlock_contact', 'export_contact') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACCESS_TYPE');
  END IF;

  SELECT p.is_vendor_admin, (p.account_status = 'active')
  INTO v_is_vendor, v_is_active
  FROM public.profiles p
  WHERE p.id = v_vendor_id;

  IF NOT COALESCE(v_is_vendor,false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'VENDOR_ONLY');
  END IF;

  IF NOT COALESCE(v_is_active,false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_INACTIVE');
  END IF;

  -- Connected?
  SELECT EXISTS(
    SELECT 1
    FROM public.vendor_connections vc
    WHERE vc.vendor_id = v_vendor_id
      AND vc.field_rep_id = p_rep_user_id
      AND vc.status = 'connected'::public.vendor_connection_status
  ) INTO v_has_access;

  -- Unlocked?
  IF NOT v_has_access THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.rep_contact_unlocks u
      WHERE u.vendor_user_id = v_vendor_id
        AND u.rep_user_id = p_rep_user_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCESS_NOT_AUTHORIZED');
  END IF;

  INSERT INTO public.rep_contact_access_log (
    vendor_user_id,
    rep_user_id,
    access_type,
    ip_hash,
    user_agent
  ) VALUES (
    v_vendor_id,
    p_rep_user_id,
    p_access_type,
    p_ip_hash,
    LEFT(p_user_agent, 500)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_rep_contact_access(uuid, text, text, text) TO authenticated;

-- 4) Admin-only metrics RPC (no view needed)
CREATE OR REPLACE FUNCTION public.get_rep_contact_access_metrics()
RETURNS TABLE (
  vendor_user_id uuid,
  total_accesses bigint,
  unique_reps_accessed bigint,
  last_access_at timestamptz,
  accesses_last_hour bigint,
  accesses_last_24h bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT (public.is_admin_allowlisted(auth.uid()) OR public.is_staff_allowlisted(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin or staff only';
  END IF;

  RETURN QUERY
  SELECT
    l.vendor_user_id,
    COUNT(*) AS total_accesses,
    COUNT(DISTINCT l.rep_user_id) AS unique_reps_accessed,
    MAX(l.created_at) AS last_access_at,
    COUNT(*) FILTER (WHERE l.created_at > now() - interval '1 hour') AS accesses_last_hour,
    COUNT(*) FILTER (WHERE l.created_at > now() - interval '24 hours') AS accesses_last_24h
  FROM public.rep_contact_access_log l
  GROUP BY l.vendor_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rep_contact_access_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rep_contact_access_metrics() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_rep_contact_access_metrics() TO authenticated;