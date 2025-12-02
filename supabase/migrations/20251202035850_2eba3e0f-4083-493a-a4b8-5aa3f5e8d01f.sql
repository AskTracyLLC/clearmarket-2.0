-- Add email tracking to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

COMMENT ON COLUMN public.notifications.email_sent_at IS
  'When an email notification was sent for this row (null = never sent).';

-- Extend notification_preferences with email channel toggles
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_messages boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_connections boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_reviews boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_system boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.email_messages IS 'Send email when you receive a new message or reply.';
COMMENT ON COLUMN public.notification_preferences.email_connections IS 'Send email for connection requests and connection changes.';
COMMENT ON COLUMN public.notification_preferences.email_reviews IS 'Send email when you receive a new review.';
COMMENT ON COLUMN public.notification_preferences.email_system IS 'Send email for important system notices (account/safety/credits).';