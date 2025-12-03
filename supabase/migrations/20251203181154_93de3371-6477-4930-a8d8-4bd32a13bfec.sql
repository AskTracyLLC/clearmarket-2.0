-- Add last_reminder_sent_at column to track when reminder was sent for each connection
-- This prevents duplicate reminders for the same connection
ALTER TABLE public.rep_interest
ADD COLUMN last_reminder_sent_at timestamp with time zone DEFAULT NULL;