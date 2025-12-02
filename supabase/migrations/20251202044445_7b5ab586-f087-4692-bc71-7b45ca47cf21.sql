-- ============================================
-- ADMIN MODERATION DASHBOARD - DATABASE CHANGES
-- ============================================

-- 1. Extend user_reports table with moderation fields
ALTER TABLE public.user_reports
ADD COLUMN IF NOT EXISTS target_type text,              
ADD COLUMN IF NOT EXISTS target_id uuid,                
ADD COLUMN IF NOT EXISTS admin_notes text;

COMMENT ON COLUMN public.user_reports.target_type IS 'Type of entity being reported: review, message, profile, post, system, etc.';
COMMENT ON COLUMN public.user_reports.target_id IS 'Primary key of the reported entity when applicable.';
COMMENT ON COLUMN public.user_reports.admin_notes IS 'Internal notes entered by admins while moderating this report.';

-- Update existing reports to have target_type based on context
UPDATE public.user_reports 
SET target_type = 'profile' 
WHERE target_type IS NULL AND conversation_id IS NULL;

UPDATE public.user_reports 
SET target_type = 'message' 
WHERE target_type IS NULL AND conversation_id IS NOT NULL;

-- 2. Add moderation fields to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS exclude_from_trust_score boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS moderation_notes text;

COMMENT ON COLUMN public.reviews.is_hidden IS 'When true, review is hidden from public display but preserved in database.';
COMMENT ON COLUMN public.reviews.exclude_from_trust_score IS 'When true, review does not contribute to Trust Score calculations.';
COMMENT ON COLUMN public.reviews.moderation_notes IS 'Internal notes from admin moderation actions.';