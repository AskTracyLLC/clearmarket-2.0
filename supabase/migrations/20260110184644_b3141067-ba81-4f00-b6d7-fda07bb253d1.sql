-- Ensure support_queue_actions is append-only (audit log)
-- Drop any UPDATE/DELETE policies that may exist

DROP POLICY IF EXISTS "Staff can update support queue actions" ON public.support_queue_actions;
DROP POLICY IF EXISTS "Super admins can delete support queue actions" ON public.support_queue_actions;
DROP POLICY IF EXISTS "Staff can delete support queue actions" ON public.support_queue_actions;

-- Add a comment to document the intent
COMMENT ON TABLE public.support_queue_actions IS 'Append-only audit log for support queue actions. No UPDATE/DELETE allowed - use support_queue_internal_notes for editable discussions.';