-- Lock down EXECUTE on security definer trigger functions
REVOKE EXECUTE ON FUNCTION public.sync_support_ticket_to_queue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_report_to_queue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_review_to_queue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_background_check_to_queue() FROM PUBLIC;

-- Backfill function should NOT be callable by everyone either
REVOKE EXECUTE ON FUNCTION public.backfill_support_queue_items() FROM PUBLIC;