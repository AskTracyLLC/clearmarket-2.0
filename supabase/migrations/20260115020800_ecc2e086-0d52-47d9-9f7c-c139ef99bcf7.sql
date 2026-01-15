-- ==========================================================================
-- Fix hard FK blockers for vendor deletion:
-- working_terms_requests.vendor_id and working_terms_rows.vendor_id
-- Convert NO ACTION -> SET NULL (preserve history)
-- ==========================================================================

-- 1) Make vendor_id nullable (required for SET NULL)
ALTER TABLE public.working_terms_requests
  ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE public.working_terms_rows
  ALTER COLUMN vendor_id DROP NOT NULL;

-- 2) Replace FK constraints with ON DELETE SET NULL
ALTER TABLE public.working_terms_requests
  DROP CONSTRAINT IF EXISTS working_terms_requests_vendor_id_fkey;

ALTER TABLE public.working_terms_requests
  ADD CONSTRAINT working_terms_requests_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.working_terms_rows
  DROP CONSTRAINT IF EXISTS working_terms_rows_vendor_id_fkey;

ALTER TABLE public.working_terms_rows
  ADD CONSTRAINT working_terms_rows_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;