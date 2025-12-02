-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Core categories (extendable later)
  notify_new_message boolean NOT NULL DEFAULT true,
  notify_connection_request boolean NOT NULL DEFAULT true,
  notify_connection_accepted boolean NOT NULL DEFAULT true,
  notify_review_received boolean NOT NULL DEFAULT true,
  notify_credits_events boolean NOT NULL DEFAULT true,
  notify_system_updates boolean NOT NULL DEFAULT true
);

-- Add comments
COMMENT ON TABLE public.notification_preferences IS 'Per-user settings for in-app notification categories.';
COMMENT ON COLUMN public.notification_preferences.notify_new_message IS 'In-app notifications when you receive a new message.';
COMMENT ON COLUMN public.notification_preferences.notify_connection_request IS 'In-app notifications when someone requests to connect.';
COMMENT ON COLUMN public.notification_preferences.notify_connection_accepted IS 'In-app notifications when your connection request is accepted.';
COMMENT ON COLUMN public.notification_preferences.notify_review_received IS 'In-app notifications when you receive a new review.';
COMMENT ON COLUMN public.notification_preferences.notify_credits_events IS 'In-app notifications about credits (low balance, purchases, etc.).';
COMMENT ON COLUMN public.notification_preferences.notify_system_updates IS 'Announcements and important system updates.';

-- Timestamps trigger
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);