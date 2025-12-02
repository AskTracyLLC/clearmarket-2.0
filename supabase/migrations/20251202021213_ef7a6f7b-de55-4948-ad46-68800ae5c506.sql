-- Create user_reports table for lightweight reporting system
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reporter_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason_category text NOT NULL,
  reason_details text,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  reviewer_notes text,
  CONSTRAINT user_reports_no_self_report CHECK (reporter_user_id != reported_user_id)
);

CREATE INDEX idx_user_reports_reporter ON public.user_reports(reporter_user_id);
CREATE INDEX idx_user_reports_reported ON public.user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);

COMMENT ON TABLE public.user_reports IS 'User-submitted reports about other users and/or specific conversations.';
COMMENT ON COLUMN public.user_reports.reporter_user_id IS 'User who submitted the report.';
COMMENT ON COLUMN public.user_reports.reported_user_id IS 'User being reported.';
COMMENT ON COLUMN public.user_reports.status IS 'open, reviewed, dismissed, action_taken';

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_user_id);

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.user_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.user_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

-- Admins can update report status/notes
CREATE POLICY "Admins can update reports"
ON public.user_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);