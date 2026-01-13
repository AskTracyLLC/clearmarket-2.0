BEGIN;

-- 1) Backfill any existing rows BEFORE tightening the constraint
UPDATE public.support_queue_items
SET category = 'violation_review'
WHERE category IN ('user_reports', 'moderation');

-- 2) Drop and recreate the category constraint WITHOUT user_reports/moderation
ALTER TABLE public.support_queue_items
DROP CONSTRAINT IF EXISTS support_queue_items_category_check;

ALTER TABLE public.support_queue_items
ADD CONSTRAINT support_queue_items_category_check
CHECK (category = ANY (ARRAY[
  'violation_review'::text,
  'reviews'::text,
  'background_checks'::text,
  'billing'::text,
  'support_tickets'::text,
  'vendor_verification'::text,
  'dual_role_requests'::text,
  'other'::text
]));

COMMIT;