-- Add reviewed_at and fixed_at columns to checklist_item_feedback
ALTER TABLE public.checklist_item_feedback
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz;

-- Update the enum to use 'reviewed' and 'fixed' instead of 'acknowledged' and 'resolved'
-- First update any existing data
UPDATE public.checklist_item_feedback SET status = 'open' WHERE status = 'acknowledged';
UPDATE public.checklist_item_feedback SET status = 'open' WHERE status = 'resolved';

-- Drop and recreate the enum with new values
ALTER TABLE public.checklist_item_feedback 
  ALTER COLUMN status DROP DEFAULT;
  
ALTER TABLE public.checklist_item_feedback 
  ALTER COLUMN status TYPE text;

DROP TYPE IF EXISTS public.checklist_feedback_status;

CREATE TYPE public.checklist_feedback_status AS ENUM ('open', 'reviewed', 'fixed');

ALTER TABLE public.checklist_item_feedback 
  ALTER COLUMN status TYPE public.checklist_feedback_status 
  USING status::public.checklist_feedback_status;
  
ALTER TABLE public.checklist_item_feedback 
  ALTER COLUMN status SET DEFAULT 'open';