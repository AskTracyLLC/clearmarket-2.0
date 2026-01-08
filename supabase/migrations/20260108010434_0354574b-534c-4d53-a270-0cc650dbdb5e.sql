-- =============================================
-- 0) Enums
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dual_role_request_status') THEN
    CREATE TYPE public.dual_role_request_status AS ENUM ('pending','approved','denied','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE public.verification_status AS ENUM ('none','submitted','verified','rejected');
  END IF;
END$$;

-- =============================================
-- 1) Dual Role Access Requests table
-- =============================================
CREATE TABLE IF NOT EXISTS public.dual_role_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- This request is specifically for enabling vendor capability on a rep account (dual role)
  request_vendor boolean NOT NULL DEFAULT true,
  -- Required vendor basics for legitimacy
  business_name text NOT NULL,
  office_phone text NOT NULL,
  office_email text NOT NULL,
  -- Recommended legitimacy signals (optional)
  business_city text,
  business_state text,
  website_url text,
  linkedin_url text,
  entity_type text CHECK (entity_type IN ('LLC','Corporation','Sole Proprietor','Partnership','Other')),
  year_established int CHECK (year_established IS NULL OR (year_established >= 1900 AND year_established <= 2100)),
  -- Optional: EIN (admin-only concept). Store last4 only to reduce sensitivity.
  ein_last4 text CHECK (ein_last4 IS NULL OR ein_last4 ~ '^[0-9]{4}$'),
  -- Optional Trust Add-On: General Liability badge (active only if verified + not expired)
  gl_status public.verification_status NOT NULL DEFAULT 'none',
  gl_expires_on date,
  gl_verified_at timestamptz,
  gl_verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gl_decision_note text,
  message text,
  status public.dual_role_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dual_role_vendor_requested CHECK (request_vendor = true),
  CONSTRAINT gl_verified_requires_fields CHECK (
    gl_status <> 'verified'
    OR (gl_expires_on IS NOT NULL AND gl_verified_at IS NOT NULL AND gl_verified_by IS NOT NULL)
  ),
  CONSTRAINT gl_expires_reasonable CHECK (
    gl_expires_on IS NULL OR (gl_expires_on >= date '2000-01-01' AND gl_expires_on <= date '2100-12-31')
  )
);

-- One pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_dual_role_access_one_pending
ON public.dual_role_access_requests (user_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dual_role_access_status_created
ON public.dual_role_access_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dual_role_access_user_created
ON public.dual_role_access_requests (user_id, created_at DESC);

-- =============================================
-- 2) updated_at trigger helper (create if not exists)
-- =============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dual_role_access_set_updated_at ON public.dual_role_access_requests;
CREATE TRIGGER trg_dual_role_access_set_updated_at
BEFORE UPDATE ON public.dual_role_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 3) RLS Policies
-- =============================================
ALTER TABLE public.dual_role_access_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own dual role access requests" ON public.dual_role_access_requests;
CREATE POLICY "Users can view own dual role access requests"
ON public.dual_role_access_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own request
DROP POLICY IF EXISTS "Users can create own dual role access request" ON public.dual_role_access_requests;
CREATE POLICY "Users can create own dual role access request"
ON public.dual_role_access_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own request row (but only cancellation will be allowed by trigger)
DROP POLICY IF EXISTS "Users can update own dual role access request" ON public.dual_role_access_requests;
CREATE POLICY "Users can update own dual role access request"
ON public.dual_role_access_requests
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all
DROP POLICY IF EXISTS "Admins can view dual role access requests" ON public.dual_role_access_requests;
CREATE POLICY "Admins can view dual role access requests"
ON public.dual_role_access_requests
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Admins can update all (approve/deny + verify GL)
DROP POLICY IF EXISTS "Admins can update dual role access requests" ON public.dual_role_access_requests;
CREATE POLICY "Admins can update dual role access requests"
ON public.dual_role_access_requests
FOR UPDATE
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- =============================================
-- 4) User update guardrail: only allow pending -> cancelled
-- =============================================
CREATE OR REPLACE FUNCTION public.protect_dual_role_access_request_user_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    -- Lock submitted fields so requester can't edit after submit
    NEW.business_name = OLD.business_name;
    NEW.office_phone = OLD.office_phone;
    NEW.office_email = OLD.office_email;
    NEW.business_city = OLD.business_city;
    NEW.business_state = OLD.business_state;
    NEW.website_url = OLD.website_url;
    NEW.linkedin_url = OLD.linkedin_url;
    NEW.entity_type = OLD.entity_type;
    NEW.year_established = OLD.year_established;
    NEW.ein_last4 = OLD.ein_last4;
    NEW.gl_status = OLD.gl_status;
    NEW.gl_expires_on = OLD.gl_expires_on;
    NEW.gl_verified_at = OLD.gl_verified_at;
    NEW.gl_verified_by = OLD.gl_verified_by;
    NEW.gl_decision_note = OLD.gl_decision_note;
    NEW.message = OLD.message;
    NEW.reviewed_by = NULL;
    NEW.reviewed_at = NULL;
    NEW.decision_note = NULL;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only cancellation is allowed by the requester';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_dual_role_access_request_user_updates ON public.dual_role_access_requests;
CREATE TRIGGER trg_protect_dual_role_access_request_user_updates
BEFORE UPDATE ON public.dual_role_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_dual_role_access_request_user_updates();

ALTER FUNCTION public.protect_dual_role_access_request_user_updates() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_dual_role_access_request_user_updates() FROM PUBLIC;

-- =============================================
-- 5) View for GL badge status (privacy-safe; no docs stored)
-- =============================================
CREATE OR REPLACE VIEW public.public_vendor_gl_badges AS
SELECT
  p.id AS user_id,
  (
    r.gl_status = 'verified'
    AND r.gl_expires_on IS NOT NULL
    AND r.gl_expires_on >= current_date
  ) AS has_active_gl_badge,
  r.gl_expires_on
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT *
  FROM public.dual_role_access_requests
  WHERE user_id = p.id
    AND status = 'approved'
  ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
  LIMIT 1
) r ON true;

-- =============================================
-- 6) Admin review RPC (approve/deny + optional verify GL)
-- Also sends schema-correct notifications.
-- =============================================
CREATE OR REPLACE FUNCTION public.review_dual_role_access_request(
  p_request_id uuid,
  p_decision text,                -- 'approved' or 'denied'
  p_decision_note text DEFAULT NULL,
  p_verify_gl boolean DEFAULT false,
  p_gl_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_req public.dual_role_access_requests%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_user(v_admin_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_decision NOT IN ('approved','denied') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_req
  FROM public.dual_role_access_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_req.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Validate GL verification requires expiration date
  IF p_verify_gl = true AND v_req.gl_expires_on IS NULL THEN
    RAISE EXCEPTION 'Cannot verify GL without an expiration date';
  END IF;

  UPDATE public.dual_role_access_requests
  SET
    status = CASE WHEN p_decision = 'approved' THEN 'approved'::public.dual_role_request_status
                  ELSE 'denied'::public.dual_role_request_status END,
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    decision_note = p_decision_note,
    gl_status = CASE
      WHEN p_decision = 'approved' AND p_verify_gl = true THEN 'verified'::public.verification_status
      ELSE gl_status
    END,
    gl_verified_by = CASE WHEN p_decision = 'approved' AND p_verify_gl = true THEN v_admin_id ELSE gl_verified_by END,
    gl_verified_at = CASE WHEN p_decision = 'approved' AND p_verify_gl = true THEN now() ELSE gl_verified_at END,
    gl_decision_note = CASE WHEN p_decision = 'approved' AND p_verify_gl = true THEN p_gl_note ELSE gl_decision_note END
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    -- If you have a trigger that blocks direct role-field edits, this flag allows server-side update.
    PERFORM set_config('app.allow_role_update', 'on', true);

    UPDATE public.profiles
    SET
      is_vendor_admin = true,
      active_role = CASE WHEN COALESCE(v_profile.active_role,'') = '' THEN 'rep' ELSE v_profile.active_role END,
      updated_at = now()
    WHERE id = v_req.user_id;

    INSERT INTO public.notifications (
      user_id, type, ref_id, title, body, role_filter, target_url, status, metadata
    ) VALUES (
      v_req.user_id,
      'dual_role_request',
      v_req.id,
      'Dual Role access approved',
      COALESCE(p_decision_note, 'You can now switch between Field Rep and Vendor dashboards.'),
      'both',
      '/settings',
      'unread',
      jsonb_build_object('request_id', v_req.id, 'decision', 'approved')
    );

    -- Optional: separate note if GL is verified
    IF p_verify_gl = true THEN
      INSERT INTO public.notifications (
        user_id, type, ref_id, title, body, role_filter, target_url, status, metadata
      ) VALUES (
        v_req.user_id,
        'vendor_gl_badge',
        v_req.id,
        'GL Insurance verified',
        COALESCE(p_gl_note, 'Your General Liability badge is now active (until expiration).'),
        'vendor',
        '/settings',
        'unread',
        jsonb_build_object('request_id', v_req.id, 'gl_expires_on', v_req.gl_expires_on)
      );
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'approved');
  END IF;

  INSERT INTO public.notifications (
    user_id, type, ref_id, title, body, role_filter, target_url, status, metadata
  ) VALUES (
    v_req.user_id,
    'dual_role_request',
    v_req.id,
    'Dual Role access denied',
    COALESCE(p_decision_note, 'Your Dual Role request was denied.'),
    'both',
    '/settings',
    'unread',
    jsonb_build_object('request_id', v_req.id, 'decision', 'denied')
  );

  RETURN jsonb_build_object('ok', true, 'status', 'denied');
END;
$$;

ALTER FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) TO authenticated;

-- =============================================
-- 7) Ensure role_filter index exists
-- =============================================
CREATE INDEX IF NOT EXISTS idx_notifications_role_filter ON public.notifications(role_filter);