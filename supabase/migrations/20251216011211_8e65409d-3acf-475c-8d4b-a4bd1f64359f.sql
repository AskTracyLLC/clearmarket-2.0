-- Create checklist_assignment_events table for audit logging
CREATE TABLE public.checklist_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('auto_on_connect', 'manual_vendor', 'manual_admin')),
  notes text
);

-- Enable RLS
ALTER TABLE public.checklist_assignment_events ENABLE ROW LEVEL SECURITY;

-- Only admins/staff can view assignment events
CREATE POLICY "Staff can view all checklist assignment events"
ON public.checklist_assignment_events
FOR SELECT
USING (is_staff_user(auth.uid()));

-- Allow inserts from authenticated users (the app logic handles permissions)
CREATE POLICY "Authenticated users can insert assignment events"
ON public.checklist_assignment_events
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for common queries
CREATE INDEX idx_checklist_assignment_events_created_at ON public.checklist_assignment_events (created_at DESC);
CREATE INDEX idx_checklist_assignment_events_template_id ON public.checklist_assignment_events (template_id);
CREATE INDEX idx_checklist_assignment_events_vendor_id ON public.checklist_assignment_events (vendor_id);
CREATE INDEX idx_checklist_assignment_events_source ON public.checklist_assignment_events (source);