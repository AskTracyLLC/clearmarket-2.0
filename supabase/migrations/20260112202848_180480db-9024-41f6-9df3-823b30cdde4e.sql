-- Safety: reset function cleanly
DROP FUNCTION IF EXISTS public.sync_dual_role_request_to_queue();

-- Create trigger function to sync dual_role_access_requests to support_queue_items
CREATE OR REPLACE FUNCTION public.sync_dual_role_request_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name text := 'Unknown';
  v_location text;
BEGIN
  -- derive requester name safely (no dependency on profiles.email)
  SELECT COALESCE(p.full_name, 'Unknown')
  INTO v_requester_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  v_location :=
    COALESCE(NEW.business_city, '') ||
    CASE
      WHEN NEW.business_city IS NOT NULL AND NEW.business_state IS NOT NULL THEN ', '
      ELSE ''
    END ||
    COALESCE(NEW.business_state, '');

  -- Only create queue item for new pending requests
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.support_queue_items (
      category,
      source_type,
      source_id,
      title,
      preview,
      priority,
      status,
      target_url,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      'dual_role_requests',
      'dual_role_access_request',
      NEW.id,
      'Dual Role Access Request',
      COALESCE(NEW.business_name, 'Business') || ' - ' || COALESCE(v_requester_name, 'Unknown'),
      'normal',
      'open',
      '/admin/support-queue?category=dual_role_requests',
      jsonb_build_object(
        'request_id', NEW.id,
        'requester_id', NEW.user_id,
        'requester_name', COALESCE(v_requester_name, 'Unknown'),
        'business_name', NEW.business_name,
        'office_email', NEW.office_email,
        'office_phone', NEW.office_phone,
        'location', v_location,
        'gl_status', COALESCE(NEW.gl_status, 'none'),
        'gl_expires_on', NEW.gl_expires_on,
        'submitted_at', NEW.created_at
      ),
      NEW.created_at,
      NEW.created_at
    );
  END IF;

  -- Update queue item when request status changes away from pending
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    UPDATE public.support_queue_items
    SET
      status = 'resolved',
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE source_type = 'dual_role_access_request'
      AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_dual_role_to_queue ON public.dual_role_access_requests;
CREATE TRIGGER trg_sync_dual_role_to_queue
  AFTER INSERT OR UPDATE ON public.dual_role_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dual_role_request_to_queue();

-- Backfill existing pending requests (idempotent)
INSERT INTO public.support_queue_items (
  category,
  source_type,
  source_id,
  title,
  preview,
  priority,
  status,
  target_url,
  metadata,
  created_at,
  updated_at
)
SELECT
  'dual_role_requests',
  'dual_role_access_request',
  dr.id,
  'Dual Role Access Request',
  COALESCE(dr.business_name, 'Business') || ' - ' || COALESCE(p.full_name, 'Unknown'),
  'normal',
  'open',
  '/admin/support-queue?category=dual_role_requests',
  jsonb_build_object(
    'request_id', dr.id,
    'requester_id', dr.user_id,
    'requester_name', COALESCE(p.full_name, 'Unknown'),
    'business_name', dr.business_name,
    'office_email', dr.office_email,
    'office_phone', dr.office_phone,
    'location',
      COALESCE(dr.business_city, '') ||
      CASE WHEN dr.business_city IS NOT NULL AND dr.business_state IS NOT NULL THEN ', ' ELSE '' END ||
      COALESCE(dr.business_state, ''),
    'gl_status', COALESCE(dr.gl_status, 'none'),
    'gl_expires_on', dr.gl_expires_on,
    'submitted_at', dr.created_at
  ),
  dr.created_at,
  dr.created_at
FROM public.dual_role_access_requests dr
LEFT JOIN public.profiles p ON p.id = dr.user_id
WHERE dr.status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.support_queue_items sq
    WHERE sq.source_type = 'dual_role_access_request'
      AND sq.source_id = dr.id
  );

-- Add unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_support_queue_dual_role_source
ON public.support_queue_items (source_type, source_id)
WHERE source_type = 'dual_role_access_request';