-- Create feedback type enum
CREATE TYPE checklist_feedback_type AS ENUM ('bug', 'confusing', 'completed_not_marked', 'suggestion', 'other');

-- Create feedback status enum
CREATE TYPE checklist_feedback_status AS ENUM ('open', 'acknowledged', 'resolved');

-- Create checklist_item_feedback table
CREATE TABLE public.checklist_item_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_checklist_item_id UUID REFERENCES public.user_checklist_items(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  feedback_type checklist_feedback_type NOT NULL,
  message TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT '{}',
  status checklist_feedback_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.checklist_item_feedback ENABLE ROW LEVEL SECURITY;

-- Users can create their own feedback
CREATE POLICY "Users can create their own feedback"
  ON public.checklist_item_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON public.checklist_item_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.checklist_item_feedback
  FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admins can update feedback status
CREATE POLICY "Admins can update feedback status"
  ON public.checklist_item_feedback
  FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Create index for querying by template/item
CREATE INDEX idx_checklist_feedback_template ON public.checklist_item_feedback(template_id);
CREATE INDEX idx_checklist_feedback_item ON public.checklist_item_feedback(item_id);
CREATE INDEX idx_checklist_feedback_user ON public.checklist_item_feedback(user_id);
CREATE INDEX idx_checklist_feedback_status ON public.checklist_item_feedback(status);