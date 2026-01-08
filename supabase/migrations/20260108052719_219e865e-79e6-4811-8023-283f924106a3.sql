-- Enable pgcrypto for gen_random_bytes / crypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: vendor_proposal_shares
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_proposal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.vendor_client_proposals(id) ON DELETE CASCADE,
  vendor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  passcode_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_proposal_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage own shares" ON public.vendor_proposal_shares;
CREATE POLICY "Vendors manage own shares"
ON public.vendor_proposal_shares
FOR ALL
USING (vendor_user_id = auth.uid())
WITH CHECK (vendor_user_id = auth.uid());

-- Use the existing updated_at trigger function your project already uses
DROP TRIGGER IF EXISTS set_updated_at_vendor_proposal_shares ON public.vendor_proposal_shares;
CREATE TRIGGER set_updated_at_vendor_proposal_shares
  BEFORE UPDATE ON public.vendor_proposal_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Table: vendor_proposal_share_views
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_proposal_share_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.vendor_proposal_shares(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  viewer_ip text,
  viewer_user_agent text
);

ALTER TABLE public.vendor_proposal_share_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can view own share views" ON public.vendor_proposal_share_views;
CREATE POLICY "Vendors can view own share views"
ON public.vendor_proposal_share_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_proposal_shares s
    WHERE s.id = share_id AND s.vendor_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow insert share views" ON public.vendor_proposal_share_views;
CREATE POLICY "Allow insert share views"
ON public.vendor_proposal_share_views
FOR INSERT
WITH CHECK (
  viewer_ip IS NULL
  AND viewer_user_agent IS NULL
);

-- ============================================================
-- RPC: create_proposal_share
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_proposal_share(
  p_proposal_id uuid,
  p_passcode text DEFAULT NULL,
  p_expires_in_days int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_user_id uuid := auth.uid();
  v_share_id uuid;
  v_share_token text;
  v_expires_at timestamptz;
  v_passcode_hash text;
BEGIN
  IF v_vendor_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_client_proposals
    WHERE id = p_proposal_id AND vendor_user_id = v_vendor_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;

  IF p_expires_in_days IS NOT NULL AND p_expires_in_days > 0 THEN
    v_expires_at := now() + (p_expires_in_days || ' days')::interval;
  END IF;

  IF p_passcode IS NOT NULL AND length(trim(p_passcode)) > 0 THEN
    v_passcode_hash := crypt(p_passcode, gen_salt('bf'));
  END IF;

  INSERT INTO public.vendor_proposal_shares (
    proposal_id,
    vendor_user_id,
    passcode_hash,
    expires_at
  ) VALUES (
    p_proposal_id,
    v_vendor_user_id,
    v_passcode_hash,
    v_expires_at
  )
  RETURNING id, share_token INTO v_share_id, v_share_token;

  RETURN jsonb_build_object(
    'success', true,
    'share_id', v_share_id,
    'share_token', v_share_token,
    'expires_at', v_expires_at
  );
END;
$$;

-- ============================================================
-- RPC: revoke_proposal_share
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_proposal_share(p_share_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_user_id uuid := auth.uid();
BEGIN
  IF v_vendor_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE public.vendor_proposal_shares
  SET revoked_at = now(), updated_at = now()
  WHERE id = p_share_id
    AND vendor_user_id = v_vendor_user_id
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHARE_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- RPC: get_shared_proposal (public, called by anon)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shared_proposal(
  p_share_token text,
  p_passcode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.vendor_proposal_shares%ROWTYPE;
  v_proposal RECORD;
  v_vendor_name text;
  v_lines jsonb;
BEGIN
  SELECT * INTO v_share
  FROM public.vendor_proposal_shares
  WHERE share_token = p_share_token
  FOR UPDATE;

  IF v_share IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHARE_NOT_FOUND');
  END IF;

  IF v_share.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHARE_REVOKED');
  END IF;

  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHARE_EXPIRED');
  END IF;

  IF v_share.locked_until IS NOT NULL AND v_share.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHARE_LOCKED');
  END IF;

  IF v_share.passcode_hash IS NOT NULL THEN
    IF p_passcode IS NULL OR p_passcode = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'PASSCODE_REQUIRED', 'requires_passcode', true);
    END IF;

    IF v_share.passcode_hash <> crypt(p_passcode, v_share.passcode_hash) THEN
      UPDATE public.vendor_proposal_shares
      SET
        failed_attempts = failed_attempts + 1,
        locked_until = CASE
          WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE locked_until
        END,
        updated_at = now()
      WHERE id = v_share.id;

      RETURN jsonb_build_object('success', false, 'error', 'INVALID_PASSCODE');
    END IF;

    UPDATE public.vendor_proposal_shares
    SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE id = v_share.id;
  END IF;

  INSERT INTO public.vendor_proposal_share_views (share_id)
  VALUES (v_share.id);

  SELECT
    p.id,
    p.name,
    p.client_name,
    p.disclaimer,
    p.status,
    p.effective_as_of,
    p.updated_at
  INTO v_proposal
  FROM public.vendor_client_proposals p
  WHERE p.id = v_share.proposal_id;

  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;

  SELECT COALESCE(vp.company_name, pr.full_name, 'Vendor')
  INTO v_vendor_name
  FROM public.profiles pr
  LEFT JOIN public.vendor_profile vp ON vp.user_id = pr.id
  WHERE pr.id = v_share.vendor_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'state_code', l.state_code,
      'state_name', l.state_name,
      'county_name', l.county_name,
      'is_all_counties', l.is_all_counties,
      'order_type', l.order_type,
      'proposed_rate', l.proposed_rate
    )
    ORDER BY l.state_code, l.county_name, l.order_type
  ), '[]'::jsonb)
  INTO v_lines
  FROM public.vendor_client_proposal_lines l
  WHERE l.proposal_id = v_proposal.id;

  RETURN jsonb_build_object(
    'success', true,
    'requires_passcode', (v_share.passcode_hash IS NOT NULL),
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'name', v_proposal.name,
      'client_name', v_proposal.client_name,
      'disclaimer', v_proposal.disclaimer,
      'status', v_proposal.status,
      'effective_as_of', v_proposal.effective_as_of,
      'updated_at', v_proposal.updated_at
    ),
    'vendor_name', v_vendor_name,
    'lines', v_lines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_proposal(text, text) TO anon;