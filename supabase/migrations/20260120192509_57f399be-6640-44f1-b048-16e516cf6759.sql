BEGIN;

-- 1) Drop the trigger that syncs background checks to support queue (if it exists)
DROP TRIGGER IF EXISTS sync_background_check_to_queue_trigger ON public.background_checks;

-- 2) Drop the sync function (if it exists)
DROP FUNCTION IF EXISTS public.sync_background_check_to_queue();

-- 3) Resolve existing background check support queue items
UPDATE public.support_queue_items
SET
  status = 'resolved',
  resolved_at = now(),
  updated_at = now()
WHERE category = 'background_checks'
  AND status <> 'resolved';

COMMIT;