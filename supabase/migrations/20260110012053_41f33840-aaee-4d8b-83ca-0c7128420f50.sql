-- Fix views to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures RLS policies of the querying user are enforced

DROP VIEW IF EXISTS public.support_queue_counts_by_category_status;
CREATE VIEW public.support_queue_counts_by_category_status
WITH (security_invoker = true)
AS
SELECT category, status, COUNT(*)::int AS item_count
FROM public.support_queue_items
GROUP BY category, status;

DROP VIEW IF EXISTS public.support_queue_open_counts_by_category;
CREATE VIEW public.support_queue_open_counts_by_category
WITH (security_invoker = true)
AS
SELECT category, COUNT(*)::int AS open_count
FROM public.support_queue_items
WHERE status IN ('open', 'in_progress', 'waiting')
GROUP BY category;

GRANT SELECT ON public.support_queue_counts_by_category_status TO authenticated;
GRANT SELECT ON public.support_queue_open_counts_by_category TO authenticated;