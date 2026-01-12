-- Dual Role Requests: vendor-verification style invariants (SAFE)

-- 1) Ensure required link columns exist (idempotent)
ALTER TABLE public.dual_role_access_requests
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

ALTER TABLE public.support_queue_items
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

-- 2) Ensure one pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_dual_role_pending_per_user
  ON public.dual_role_access_requests (user_id)
  WHERE status = 'pending';

-- 3) Protect requester updates while allowing service/admin/migrations
CREATE OR REPLACE FUNCTION public.protect_dual_role_access_request_user_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
  actor uuid := auth.uid();
BEGIN
  -- Allow migrations/server contexts (no JWT / no auth uid)
  IF jwt_role IS NULL AND actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow service role calls
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow staff/admin (guard against NULL actor)
  IF actor IS NOT NULL AND (public.is_admin_user(actor) OR public.is_staff_user(actor)) THEN
    RETURN NEW;
  END IF;

  -- Only enforce restrictions for the requester while pending
  IF OLD.status = 'pending' THEN
    -- Allow requester cancellation ONLY if no other fields changed
    IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
      IF
        NEW.business_name IS DISTINCT FROM OLD.business_name OR
        NEW.office_phone IS DISTINCT FROM OLD.office_phone OR
        NEW.office_email IS DISTINCT FROM OLD.office_email OR
        NEW.business_city IS DISTINCT FROM OLD.business_city OR
        NEW.business_state IS DISTINCT FROM OLD.business_state OR
        NEW.website_url IS DISTINCT FROM OLD.website_url OR
        NEW.linkedin_url IS DISTINCT FROM OLD.linkedin_url OR
        NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
        NEW.year_established IS DISTINCT FROM OLD.year_established OR
        NEW.ein_last4 IS DISTINCT FROM OLD.ein_last4 OR
        NEW.gl_status IS DISTINCT FROM OLD.gl_status OR
        NEW.gl_expires_on IS DISTINCT FROM OLD.gl_expires_on OR
        NEW.gl_verified_at IS DISTINCT FROM OLD.gl_verified_at OR
        NEW.gl_verified_by IS DISTINCT FROM OLD.gl_verified_by OR
        NEW.gl_decision_note IS DISTINCT FROM OLD.gl_decision_note OR
        NEW.message IS DISTINCT FROM OLD.message OR
        NEW.requested_code IS DISTINCT FROM OLD.requested_code OR
        NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      THEN
        RAISE EXCEPTION 'Only cancellation is allowed by the requester';
      END IF;

      RETURN NEW;
    END IF;

    -- Allow ONLY conversation_id to be set while pending (from backend)
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      IF
        NEW.status IS DISTINCT FROM OLD.status OR
        NEW.business_name IS DISTINCT FROM OLD.business_name OR
        NEW.office_phone IS DISTINCT FROM OLD.office_phone OR
        NEW.office_email IS DISTINCT FROM OLD.office_email OR
        NEW.business_city IS DISTINCT FROM OLD.business_city OR
        NEW.business_state IS DISTINCT FROM OLD.business_state OR
        NEW.website_url IS DISTINCT FROM OLD.website_url OR
        NEW.linkedin_url IS DISTINCT FROM OLD.linkedin_url OR
        NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
        NEW.year_established IS DISTINCT FROM OLD.year_established OR
        NEW.ein_last4 IS DISTINCT FROM OLD.ein_last4 OR
        NEW.gl_status IS DISTINCT FROM OLD.gl_status OR
        NEW.gl_expires_on IS DISTINCT FROM OLD.gl_expires_on OR
        NEW.gl_verified_at IS DISTINCT FROM OLD.gl_verified_at OR
        NEW.gl_verified_by IS DISTINCT FROM OLD.gl_verified_by OR
        NEW.gl_decision_note IS DISTINCT FROM OLD.gl_decision_note OR
        NEW.message IS DISTINCT FROM OLD.message OR
        NEW.requested_code IS DISTINCT FROM OLD.requested_code
      THEN
        RAISE EXCEPTION 'Only conversation linking is allowed while pending';
      END IF;

      RETURN NEW;
    END IF;

    -- Otherwise block requester edits while pending
    RAISE EXCEPTION 'Only cancellation is allowed by the requester';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and points to this function
DROP TRIGGER IF EXISTS trg_protect_dual_role_access_request_user_updates ON public.dual_role_access_requests;
CREATE TRIGGER trg_protect_dual_role_access_request_user_updates
BEFORE UPDATE ON public.dual_role_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_dual_role_access_request_user_updates();

-- 4) Repair mismatched categories/links for dual role requests (idempotent)
-- Canonical rule: support:dual_role_access:<request_id>
UPDATE public.conversations c
SET
  category = 'support:dual_role_access:' || r.id::text,
  conversation_type = 'support',
  updated_at = now()
FROM public.dual_role_access_requests r
WHERE r.conversation_id = c.id
  AND (c.category IS DISTINCT FROM ('support:dual_role_access:' || r.id::text)
       OR c.conversation_type IS DISTINCT FROM 'support');

-- Ensure queue items for dual role requests have conversation_id + deep-link
UPDATE public.support_queue_items sq
SET
  conversation_id = r.conversation_id,
  target_url = CASE
    WHEN r.conversation_id IS NOT NULL THEN '/messages/' || r.conversation_id::text
    ELSE sq.target_url
  END,
  metadata = COALESCE(sq.metadata, '{}'::jsonb)
            || jsonb_build_object('conversation_id', r.conversation_id),
  updated_at = now()
FROM public.dual_role_access_requests r
WHERE sq.source_type = 'dual_role_access_request'
  AND sq.source_id = r.id
  AND (sq.conversation_id IS DISTINCT FROM r.conversation_id
       OR (r.conversation_id IS NOT NULL AND sq.target_url IS DISTINCT FROM ('/messages/' || r.conversation_id::text)));