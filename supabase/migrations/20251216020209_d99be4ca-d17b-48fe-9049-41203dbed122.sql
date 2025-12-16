-- Add new columns to notifications table (safe if they already exist)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_url text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'unread';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add check constraint for status (drop first if exists to avoid conflicts)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_status_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_status_check 
      CHECK (status IN ('unread', 'read', 'snoozed'));
  END IF;
END $$;

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_active_idx
  ON public.notifications (user_id, is_deleted, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_review_later_idx
  ON public.notifications (user_id, review_later, created_at DESC);