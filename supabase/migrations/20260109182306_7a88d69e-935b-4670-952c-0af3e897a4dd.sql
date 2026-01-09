-- Ensure table has the columns the RPC writes to
ALTER TABLE public.rep_contact_access_log
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Update RPC
CREATE OR REPLACE FUNCTION public.log_rep_contact_access(
  p_vendor_user_id uuid,
  p_rep_user_id uuid,
  p_access_type text,
  p_source text DEFAULT 'unknown',
  p_metadata jsonb DEFAULT '{}'::jsonb,
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
  v_window_start timestamptz;
  v_access_count int;
  v_limit int := 60;
  v_window_minutes int := 10;
BEGIN
  -- Calculate window start
  v_window_start := now() - make_interval(mins => v_window_minutes);

  -- Count recent accesses by this vendor for this access type
  SELECT count(*)
    INTO v_access_count
  FROM public.rep_contact_access_log
  WHERE vendor_user_id = p_vendor_user_id
    AND access_type = p_access_type
    AND created_at >= v_window_start;

  -- Check rate limit
  IF v_access_count >= v_limit THEN
    INSERT INTO public.rep_contact_access_log (
      vendor_user_id,
      rep_user_id,
      access_type,
      source,
      metadata,
      ip_hash,
      user_agent
    ) VALUES (
      p_vendor_user_id,
      p_rep_user_id,
      p_access_type,
      p_source,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('rate_limited', true),
      p_ip_hash,
      LEFT(p_user_agent, 500)
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
    user_agent
  ) VALUES (
    p_vendor_user_id,
    p_rep_user_id,
    p_access_type,
    p_source,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_hash,
    LEFT(p_user_agent, 500)
  );

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Lock execution down to service role only
REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_rep_contact_access(uuid, uuid, text, text, jsonb, text, text) TO service_role;