-- Expand allowed categories for support_queue_items.category
ALTER TABLE public.support_queue_items
DROP CONSTRAINT IF EXISTS support_queue_items_category_check;

ALTER TABLE public.support_queue_items
ADD CONSTRAINT support_queue_items_category_check
CHECK (
  category IN (
    'reviews',
    'moderation',
    'background_checks',
    'user_reports',
    'billing',
    'support_tickets',
    'vendor_verification',
    'dual_role_requests',
    'other'
  )
);