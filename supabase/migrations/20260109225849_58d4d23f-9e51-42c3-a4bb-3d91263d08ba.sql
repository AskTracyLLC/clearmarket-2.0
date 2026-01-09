-- =========================================================
-- Update log_rep_contact_access RPC to include actor attribution
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_rep_contact_access(
  p_vendor_user_id uuid,
  p_rep_user_id uuid,
  p_access_type text,
  p_source text DEFAULT 'unknown'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_hash text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text,
  p_actor_user_id uuid DEFAULT NULL::uuid,
  p_actor_role text DEFAULT NULL::text,
  p_actor_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_window_start timestamptz;
  v_access_count int;
  v_limit int := 60;
  v_window_minutes int := 10;
  v_enriched_metadata jsonb;
  v_final_actor_user_id uuid;
BEGIN
  -- Basic param validation (clean fail-fast)
  IF p_vendor_user_id IS NULL OR p_rep_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'MISSING_PARAMS');
  END IF;

  -- Validate access type (defense-in-depth)
  IF p_access_type NOT IN ('view_contact', 'unlock_contact', 'export_contact') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'INVALID_ACCESS_TYPE');
  END IF;

  -- Defense-in-depth: if called with user JWT context (not service role), enforce match
  IF auth.uid() IS NOT NULL AND p_vendor_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'VENDOR_ID_MISMATCH');
  END IF;

  -- Calculate window start
  v_window_start := now() - make_interval(mins => v_window_minutes);

  -- Count recent accesses by this vendor for this access type
  SELECT count(*)
    INTO v_access_count
  FROM public.rep_contact_access_log
  WHERE vendor_user_id = p_vendor_user_id
    AND access_type = p_access_type
    AND created_at >= v_window_start;

  -- Determine final actor_user_id (explicit param > auth.uid() > vendor_user_id)
  v_final_actor_user_id := COALESCE(p_actor_user_id, auth.uid(), p_vendor_user_id);

  -- Enrich metadata with actor attribution
  v_enriched_metadata := COALESCE(p_metadata, '{}'::jsonb);
  IF p_actor_role IS NOT NULL THEN
    v_enriched_metadata := v_enriched_metadata || jsonb_build_object('actor_role', p_actor_role);
  END IF;
  IF p_actor_code IS NOT NULL THEN
    v_enriched_metadata := v_enriched_metadata || jsonb_build_object('actor_code', p_actor_code);
  END IF;

  -- Check rate limit
  IF v_access_count >= v_limit THEN
    INSERT INTO public.rep_contact_access_log (
      vendor_user_id,
      rep_user_id,
      access_type,
      source,
      metadata,
      ip_hash,
      user_agent,
      actor_user_id
    ) VALUES (
      p_vendor_user_id,
      p_rep_user_id,
      p_access_type,
      p_source,
      v_enriched_metadata || jsonb_build_object('rate_limited', true),
      p_ip_hash,
      LEFT(p_user_agent, 500),
      v_final_actor_user_id
    );

    RETURN jsonb_build_object('allowed', false, 'reason', 'RATE_LIMIT');
  END IF;

  -- Log the access
  INSERT INTO public.rep_contact_access_log (
    vendor_user_id,
    rep_user_id,
    access_type,
    source,
    metadata,
    ip_hash,
    user_agent,
    actor_user_id
  ) VALUES (
    p_vendor_user_id,
    p_rep_user_id,
    p_access_type,
    p_source,
    v_enriched_metadata,
    p_ip_hash,
    LEFT(p_user_agent, 500),
    v_final_actor_user_id
  );

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Ensure function permissions are correct
REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text, uuid, text, text) TO service_role;