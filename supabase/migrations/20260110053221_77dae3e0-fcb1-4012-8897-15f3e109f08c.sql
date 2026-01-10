-- 1) Update the category CHECK constraint to include 'vendor_verification'
ALTER TABLE public.support_queue_items
  DROP CONSTRAINT IF EXISTS support_queue_items_category_check;

ALTER TABLE public.support_queue_items
  ADD CONSTRAINT support_queue_items_category_check
  CHECK (category IN (
    'reviews', 'moderation', 'background_checks', 'user_reports',
    'billing', 'support_tickets', 'vendor_verification', 'other'
  ));

-- 2) Create sync function for vendor verification requests
CREATE OR REPLACE FUNCTION public.sync_vendor_verification_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_preview TEXT;
  v_priority TEXT := 'normal';
  v_status TEXT;
  v_vendor_name TEXT;
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
  v_resolved_by uuid;
BEGIN
  -- FK-safe actor
  SELECT p.id INTO v_actor_profile FROM public.profiles p WHERE p.id = v_actor;

  -- Only process status changes on UPDATE (INSERT always processes)
  IF TG_OP = 'UPDATE' AND OLD.vendor_verification_status IS NOT DISTINCT FROM NEW.vendor_verification_status THEN
    RETURN NEW;
  END IF;

  -- Vendor display name (avoid profiles.company_name dependency)
  SELECT COALESCE(p.full_name, 'Unknown Vendor')
  INTO v_vendor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  v_title := 'Vendor Verification: ' || v_vendor_name;

  v_preview :=
    'Requested code: ' || COALESCE(NEW.vendor_public_code_requested, 'N/A') ||
    ' | POC: ' || COALESCE(NEW.poc_name, 'Not provided');

  -- Map vendor status to queue status
  v_status := CASE NEW.vendor_verification_status
    WHEN 'pending' THEN 'open'
    WHEN 'needs_review' THEN 'waiting'
    WHEN 'verified' THEN 'resolved'
    WHEN 'rejected' THEN 'resolved'
    WHEN 'suspended' THEN 'resolved'
    ELSE 'open'
  END;

  -- Only create/update queue items for actionable statuses
  IF NEW.vendor_verification_status IN ('pending', 'needs_review') THEN
    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      created_at, updated_at
    ) VALUES (
      'vendor_verification',
      'vendor_profile',
      NEW.id,
      v_title,
      v_preview,
      v_priority,
      v_status,
      '/admin/support-queue?category=vendor_verification',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'requested_code', NEW.vendor_public_code_requested,
        'poc_name', NEW.poc_name,
        'poc_email', NEW.poc_email,
        'submitted_at', NEW.verification_submitted_at
      ),
      COALESCE(NEW.verification_submitted_at, now()),
      now()
    )
    ON CONFLICT (source_type, source_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      preview = EXCLUDED.preview,
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      updated_at = now();

  ELSIF NEW.vendor_verification_status IN ('verified', 'rejected', 'suspended') THEN
    -- FK-safe resolved_by: prefer NEW.verified_by if valid, else actor profile if valid
    SELECT p.id INTO v_resolved_by FROM public.profiles p WHERE p.id = NEW.verified_by;
    v_resolved_by := COALESCE(v_resolved_by, v_actor_profile);

    UPDATE public.support_queue_items
    SET
      status = 'resolved',
      resolved_at = COALESCE(resolved_at, now()),
      resolved_by = COALESCE(resolved_by, v_resolved_by),
      updated_at = now()
    WHERE source_type = 'vendor_profile'
      AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Create trigger on vendor_profile
DROP TRIGGER IF EXISTS trg_sync_vendor_verification_to_queue ON public.vendor_profile;
CREATE TRIGGER trg_sync_vendor_verification_to_queue
  AFTER INSERT OR UPDATE OF vendor_verification_status
  ON public.vendor_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vendor_verification_to_queue();

-- 4) Backfill existing pending verification requests
INSERT INTO public.support_queue_items (
  category, source_type, source_id,
  title, preview,
  priority, status,
  target_url, metadata,
  created_at, updated_at
)
SELECT
  'vendor_verification',
  'vendor_profile',
  vp.id,
  'Vendor Verification: ' || COALESCE(p.full_name, 'Unknown Vendor'),
  'Requested code: ' || COALESCE(vp.vendor_public_code_requested, 'N/A') ||
  ' | POC: ' || COALESCE(vp.poc_name, 'Not provided'),
  'normal',
  CASE
    WHEN vp.vendor_verification_status = 'pending' THEN 'open'
    WHEN vp.vendor_verification_status = 'needs_review' THEN 'waiting'
    ELSE 'open'
  END,
  '/admin/support-queue?category=vendor_verification',
  jsonb_build_object(
    'user_id', vp.user_id,
    'requested_code', vp.vendor_public_code_requested,
    'poc_name', vp.poc_name,
    'poc_email', vp.poc_email,
    'submitted_at', vp.verification_submitted_at
  ),
  COALESCE(vp.verification_submitted_at, vp.created_at),
  now()
FROM public.vendor_profile vp
JOIN public.profiles p ON p.id = vp.user_id
WHERE vp.vendor_verification_status IN ('pending', 'needs_review')
ON CONFLICT (source_type, source_id) DO NOTHING;

-- 5) Secure the function (defense-in-depth)
REVOKE EXECUTE ON FUNCTION public.sync_vendor_verification_to_queue() FROM PUBLIC;

-- Always safe
GRANT EXECUTE ON FUNCTION public.sync_vendor_verification_to_queue() TO postgres;

-- Only if the role exists (prevents migration failure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.sync_vendor_verification_to_queue() TO supabase_admin';
  END IF;
END $$;