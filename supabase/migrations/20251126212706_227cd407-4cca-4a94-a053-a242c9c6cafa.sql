-- ============================================
-- Sequential Anonymous IDs for Reps and Vendors
-- ============================================
-- This migration adds sequential, role-specific anonymous IDs
-- (e.g., FieldRep#1, Vendor#2) to replace random UUID-based displays.
-- Primary keys remain UUIDs; this is display-only.

-- Step 1: Create sequences for each role
CREATE SEQUENCE IF NOT EXISTS public.fieldrep_anon_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.vendor_anon_seq START 1;

-- Step 2: Add anonymous_id columns to both profile tables
ALTER TABLE public.rep_profile 
ADD COLUMN IF NOT EXISTS anonymous_id text;

ALTER TABLE public.vendor_profile 
ADD COLUMN IF NOT EXISTS anonymous_id text;

-- Step 3: Backfill existing rep_profile rows with sequential IDs based on created_at
WITH numbered_reps AS (
  SELECT 
    id,
    row_number() OVER (ORDER BY created_at ASC) as seq_num
  FROM public.rep_profile
  WHERE anonymous_id IS NULL
)
UPDATE public.rep_profile
SET anonymous_id = 'FieldRep#' || numbered_reps.seq_num
FROM numbered_reps
WHERE rep_profile.id = numbered_reps.id;

-- Step 4: Backfill existing vendor_profile rows with sequential IDs based on created_at
WITH numbered_vendors AS (
  SELECT 
    id,
    row_number() OVER (ORDER BY created_at ASC) as seq_num
  FROM public.vendor_profile
  WHERE anonymous_id IS NULL
)
UPDATE public.vendor_profile
SET anonymous_id = 'Vendor#' || numbered_vendors.seq_num
FROM numbered_vendors
WHERE vendor_profile.id = numbered_vendors.id;

-- Step 5: Advance sequences to max used number + 1
-- For rep_profile
SELECT setval(
  'public.fieldrep_anon_seq',
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(anonymous_id FROM 'FieldRep#([0-9]+)') AS INTEGER)) 
     FROM public.rep_profile 
     WHERE anonymous_id ~ '^FieldRep#[0-9]+$'),
    0
  ) + 1,
  false
);

-- For vendor_profile
SELECT setval(
  'public.vendor_anon_seq',
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(anonymous_id FROM 'Vendor#([0-9]+)') AS INTEGER)) 
     FROM public.vendor_profile 
     WHERE anonymous_id ~ '^Vendor#[0-9]+$'),
    0
  ) + 1,
  false
);

-- Step 6: Set default values for future inserts
ALTER TABLE public.rep_profile 
ALTER COLUMN anonymous_id SET DEFAULT 'FieldRep#' || nextval('public.fieldrep_anon_seq');

ALTER TABLE public.vendor_profile 
ALTER COLUMN anonymous_id SET DEFAULT 'Vendor#' || nextval('public.vendor_anon_seq');

-- Step 7: Add UNIQUE constraints to prevent duplicates
ALTER TABLE public.rep_profile 
ADD CONSTRAINT rep_profile_anonymous_id_unique UNIQUE (anonymous_id);

ALTER TABLE public.vendor_profile 
ADD CONSTRAINT vendor_profile_anonymous_id_unique UNIQUE (anonymous_id);

-- Step 8: Add helpful comments
COMMENT ON COLUMN public.rep_profile.anonymous_id IS 'Sequential anonymous display ID (e.g., FieldRep#1). Generated server-side to prevent race conditions.';
COMMENT ON COLUMN public.vendor_profile.anonymous_id IS 'Sequential anonymous display ID (e.g., Vendor#1). Generated server-side to prevent race conditions.';
COMMENT ON SEQUENCE public.fieldrep_anon_seq IS 'Sequence for generating unique FieldRep anonymous IDs';
COMMENT ON SEQUENCE public.vendor_anon_seq IS 'Sequence for generating unique Vendor anonymous IDs';