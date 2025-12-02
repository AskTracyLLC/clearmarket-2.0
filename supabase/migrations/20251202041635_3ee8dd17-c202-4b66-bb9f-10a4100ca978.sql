-- Add daily digest preferences to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS digest_messages boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS digest_connections boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS digest_reviews boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS digest_system boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notification_preferences.digest_messages IS 'Include message notifications in daily digest.';
COMMENT ON COLUMN public.notification_preferences.digest_connections IS 'Include connection notifications in daily digest.';
COMMENT ON COLUMN public.notification_preferences.digest_reviews IS 'Include review notifications in daily digest.';
COMMENT ON COLUMN public.notification_preferences.digest_system IS 'Include system notifications in daily digest.';

-- Add digest tracking to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS digest_sent_at timestamptz;

COMMENT ON COLUMN public.notifications.digest_sent_at IS 'Timestamp when this notification was included in a daily digest email (null = never).';