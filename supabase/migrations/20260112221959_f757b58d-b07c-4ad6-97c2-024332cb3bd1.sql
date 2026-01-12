-- A1: Add conversation_id to dual_role_access_requests
ALTER TABLE public.dual_role_access_requests
ADD COLUMN IF NOT EXISTS conversation_id uuid;

COMMENT ON COLUMN public.dual_role_access_requests.conversation_id
IS 'Conversation thread for admin/support messaging related to this dual role request';

-- Safety: Add conversation_id to support_queue_items if not exists
ALTER TABLE public.support_queue_items
ADD COLUMN IF NOT EXISTS conversation_id uuid;

COMMENT ON COLUMN public.support_queue_items.conversation_id
IS 'Optional linked conversation for thread-based support handling';

-- A2: Update the dual role → support queue trigger (safe, no ON CONFLICT)
CREATE OR REPLACE FUNCTION public.sync_dual_role_request_to_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name text := 'Unknown User';
  target_url_value text;
  metadata_value jsonb;
BEGIN
  SELECT COALESCE(p.full_name, 'Unknown User')
  INTO requester_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NEW.conversation_id IS NOT NULL THEN
    target_url_value := '/messages/' || NEW.conversation_id::text;
  ELSE
    target_url_value := '/admin/support-queue?category=dual_role_requests';
  END IF;

  metadata_value := jsonb_build_object(
    'request_id', NEW.id,
    'requester_id', NEW.user_id,
    'requester_name', requester_name,
    'business_name', NEW.business_name,
    'office_email', NEW.office_email,
    'office_phone', NEW.office_phone,
    'requested_code', NEW.requested_code,
    'conversation_id', NEW.conversation_id
  );

  -- INSERT: create queue item once (idempotent via NOT EXISTS + unique index)
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.support_queue_items (
      source_type,
      source_id,
      category,
      status,
      priority,
      title,
      preview,
      target_url,
      metadata,
      conversation_id
    )
    SELECT
      'dual_role_access_request',
      NEW.id,
      'dual_role_requests',
      'open',
      'normal',
      'Dual Role Request: ' || COALESCE(NEW.business_name, 'Business'),
      'From: ' || requester_name || CASE WHEN NEW.requested_code IS NOT NULL AND NEW.requested_code <> '' THEN ' • Code: ' || NEW.requested_code ELSE '' END,
      target_url_value,
      metadata_value,
      NEW.conversation_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.support_queue_items sq
      WHERE sq.source_type = 'dual_role_access_request'
        AND sq.source_id = NEW.id
    );
  END IF;

  -- UPDATE: keep queue item in sync
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.support_queue_items
    SET
      title = 'Dual Role Request: ' || COALESCE(NEW.business_name, 'Business'),
      preview = 'From: ' || requester_name || CASE WHEN NEW.requested_code IS NOT NULL AND NEW.requested_code <> '' THEN ' • Code: ' || NEW.requested_code ELSE '' END,
      target_url = target_url_value,
      metadata = metadata_value,
      conversation_id = NEW.conversation_id,
      status = CASE WHEN NEW.status IN ('approved','denied') THEN 'resolved' ELSE status END,
      updated_at = now()
    WHERE source_type = 'dual_role_access_request'
      AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (safe to re-run)
DROP TRIGGER IF EXISTS trg_sync_dual_role_to_queue ON public.dual_role_access_requests;
CREATE TRIGGER trg_sync_dual_role_to_queue
AFTER INSERT OR UPDATE ON public.dual_role_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_dual_role_request_to_queue();

-- One-time sync for existing queue items that have conversation_id
UPDATE public.support_queue_items sq
SET
  target_url = '/messages/' || dr.conversation_id::text,
  conversation_id = dr.conversation_id,
  metadata = sq.metadata || jsonb_build_object(
    'conversation_id', dr.conversation_id,
    'requested_code', dr.requested_code
  ),
  updated_at = now()
FROM public.dual_role_access_requests dr
WHERE sq.source_type = 'dual_role_access_request'
  AND sq.source_id = dr.id
  AND dr.conversation_id IS NOT NULL
  AND (sq.conversation_id IS NULL OR sq.target_url NOT LIKE '/messages/%');