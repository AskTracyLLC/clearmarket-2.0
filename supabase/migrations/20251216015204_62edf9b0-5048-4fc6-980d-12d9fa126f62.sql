-- Add notification management fields
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS review_later boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_deleted_review 
ON public.notifications (user_id, is_deleted, review_later, created_at DESC);