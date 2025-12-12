-- Create email_templates table for admin-managed email content
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  placeholders_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Anyone authenticated can read templates (needed for edge functions via service role)
CREATE POLICY "Service can read email templates"
ON public.email_templates
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.email_templates (key, category, description, subject_template, body_template, placeholders_hint) VALUES
-- Messages
('message.new', 'messages', 'Sent when user receives a new message', 
 'New message from {{actor_name}}',
 '<p>Hi {{user_first_name}},</p><p>You have a new message from <strong>{{actor_name}}</strong>:</p><blockquote style="border-left: 3px solid #e5e7eb; padding-left: 12px; margin: 16px 0; color: #6b7280;">{{snippet}}</blockquote><p>Log in to ClearMarket to view the full conversation and reply.</p>',
 'user_first_name, actor_name, snippet'),

-- Connections
('connection.activity', 'connections', 'Sent for connection requests, accepts, and declines',
 '{{summary}}',
 '<p>Hi {{user_first_name}},</p><p>{{summary}}</p><p>{{snippet}}</p>',
 'user_first_name, actor_name, summary, snippet'),

-- Reviews
('review.new', 'reviews', 'Sent when user receives a new review',
 'You received a new review on ClearMarket',
 '<p>Hi {{user_first_name}},</p><p><strong>{{actor_name}}</strong> left you a review on ClearMarket.</p><p>{{snippet}}</p><p>This review contributes to your Trust Score and helps build your professional reputation.</p>',
 'user_first_name, actor_name, snippet'),

-- System
('system.update', 'system', 'Sent for system announcements and updates',
 '{{summary}}',
 '<p>Hi {{user_first_name}},</p><p>{{summary}}</p><p>{{snippet}}</p>',
 'user_first_name, summary, snippet'),

-- Territory assignments
('territory.assignment.sent', 'connections', 'Sent to rep when vendor sends territory assignment',
 '{{actor_name}} wants to assign territory to you',
 '<p>Hi {{user_first_name}},</p><p><strong>{{actor_name}}</strong> has sent you a territory assignment request.</p><p>{{snippet}}</p><p>Review and respond to this assignment in your ClearMarket dashboard.</p>',
 'user_first_name, actor_name, snippet'),

('territory.assignment.accepted', 'connections', 'Sent to vendor when rep accepts assignment',
 '{{actor_name}} accepted your territory assignment',
 '<p>Hi {{user_first_name}},</p><p>Great news! <strong>{{actor_name}}</strong> has accepted your territory assignment.</p><p>{{snippet}}</p><p>You can now view the agreement details in your network.</p>',
 'user_first_name, actor_name, snippet'),

-- Daily digest
('digest.daily', 'digest', 'Daily summary email sent at 8am Central',
 'Your ClearMarket daily summary',
 '<p>Hi {{user_first_name}},</p><p>Here''s what happened on ClearMarket in the last 24 hours:</p><p>{{summary}}</p>',
 'user_first_name, summary');