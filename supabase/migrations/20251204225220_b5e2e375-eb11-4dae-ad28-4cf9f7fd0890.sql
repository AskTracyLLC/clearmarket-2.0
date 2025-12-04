-- Admin Audit Log table for tracking important admin/staff actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  action_details jsonb,
  source_page text,
  ip_address text,
  user_agent text
);

COMMENT ON TABLE public.admin_audit_log IS
  'Records important admin/staff actions for accountability and debugging.';

COMMENT ON COLUMN public.admin_audit_log.action_type IS
  'Short machine-readable key for the action (e.g. user.deactivated, staff.invited, review.hidden).';

COMMENT ON COLUMN public.admin_audit_log.action_summary IS
  'Human-readable one-line description for quick scanning.';

COMMENT ON COLUMN public.admin_audit_log.action_details IS
  'Optional structured JSON payload with extra context (e.g. old/new values, related IDs).';

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "Admin can view audit log"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- No client inserts - logging done via edge functions only
CREATE POLICY "No client inserts into audit log"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- No client updates
CREATE POLICY "No client updates in audit log"
ON public.admin_audit_log
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- No client deletes
CREATE POLICY "No client deletes in audit log"
ON public.admin_audit_log
FOR DELETE
TO authenticated
USING (false);

-- Index for common queries
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_action_type ON public.admin_audit_log(action_type);
CREATE INDEX idx_admin_audit_log_actor ON public.admin_audit_log(actor_user_id);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log(target_user_id);