-- ==========================================================================
-- Fix FK constraints that incorrectly block user deletion
-- Convert NO ACTION to CASCADE or SET NULL where appropriate
-- ==========================================================================

-- 1) working_terms_requests.rep_id -> CASCADE (rep owns these)
ALTER TABLE public.working_terms_requests
  DROP CONSTRAINT IF EXISTS working_terms_requests_rep_id_fkey;

ALTER TABLE public.working_terms_requests
  ADD CONSTRAINT working_terms_requests_rep_id_fkey
  FOREIGN KEY (rep_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- 2) working_terms_rows.rep_id -> CASCADE (rep owns these)
ALTER TABLE public.working_terms_rows
  DROP CONSTRAINT IF EXISTS working_terms_rows_rep_id_fkey;

ALTER TABLE public.working_terms_rows
  ADD CONSTRAINT working_terms_rows_rep_id_fkey
  FOREIGN KEY (rep_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- 3) seeking_coverage_posts.filled_by_rep_id -> nullable + SET NULL
-- First make the column nullable if not already
ALTER TABLE public.seeking_coverage_posts
  ALTER COLUMN filled_by_rep_id DROP NOT NULL;

-- Then update the FK constraint
ALTER TABLE public.seeking_coverage_posts
  DROP CONSTRAINT IF EXISTS seeking_coverage_posts_filled_by_rep_id_fkey;

ALTER TABLE public.seeking_coverage_posts
  ADD CONSTRAINT seeking_coverage_posts_filled_by_rep_id_fkey
  FOREIGN KEY (filled_by_rep_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;