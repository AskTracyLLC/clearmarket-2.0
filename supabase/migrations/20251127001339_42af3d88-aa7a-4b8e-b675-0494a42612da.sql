-- ============================================================
-- Sequential Anonymous Usernames Implementation
-- ============================================================
-- Creates/resets sequences and backfills rep_profile.anonymous_id 
-- and vendor_profile.anonymous_id with sequential IDs
-- ============================================================

-- 1. Create sequences if they don't exist (they should already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'fieldrep_anon_seq') THEN
    CREATE SEQUENCE public.fieldrep_anon_seq START WITH 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'vendor_anon_seq') THEN
    CREATE SEQUENCE public.vendor_anon_seq START WITH 1;
  END IF;
END $$;

-- 2. Backfill existing Field Rep anonymous IDs with sequential numbers
-- Order by created_at to maintain consistent numbering
DO $$
DECLARE
  rep_record RECORD;
  counter INTEGER := 1;
BEGIN
  -- Reset sequence to 1
  PERFORM setval('public.fieldrep_anon_seq', 1, false);
  
  -- Loop through all rep profiles ordered by created_at
  FOR rep_record IN 
    SELECT rp.id, rp.user_id
    FROM public.rep_profile rp
    INNER JOIN public.profiles p ON p.id = rp.user_id
    WHERE p.is_fieldrep = true
    ORDER BY rp.created_at ASC
  LOOP
    -- Assign sequential ID
    UPDATE public.rep_profile
    SET anonymous_id = 'FieldRep#' || counter
    WHERE id = rep_record.id;
    
    counter := counter + 1;
  END LOOP;
  
  -- Set sequence to next available number
  IF counter > 1 THEN
    PERFORM setval('public.fieldrep_anon_seq', counter, false);
  END IF;
END $$;

-- 3. Backfill existing Vendor anonymous IDs with sequential numbers
-- Order by created_at to maintain consistent numbering
DO $$
DECLARE
  vendor_record RECORD;
  counter INTEGER := 1;
BEGIN
  -- Reset sequence to 1
  PERFORM setval('public.vendor_anon_seq', 1, false);
  
  -- Loop through all vendor profiles ordered by created_at
  FOR vendor_record IN 
    SELECT vp.id, vp.user_id
    FROM public.vendor_profile vp
    INNER JOIN public.profiles p ON p.id = vp.user_id
    WHERE p.is_vendor_admin = true
    ORDER BY vp.created_at ASC
  LOOP
    -- Assign sequential ID
    UPDATE public.vendor_profile
    SET anonymous_id = 'Vendor#' || counter
    WHERE id = vendor_record.id;
    
    counter := counter + 1;
  END LOOP;
  
  -- Set sequence to next available number
  IF counter > 1 THEN
    PERFORM setval('public.vendor_anon_seq', counter, false);
  END IF;
END $$;

-- 4. Create or replace trigger function for rep_profile
CREATE OR REPLACE FUNCTION public.assign_rep_anonymous_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign if anonymous_id is null
  IF NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'FieldRep#' || nextval('fieldrep_anon_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create or replace trigger function for vendor_profile
CREATE OR REPLACE FUNCTION public.assign_vendor_anonymous_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign if anonymous_id is null
  IF NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'Vendor#' || nextval('vendor_anon_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Drop existing triggers if they exist and recreate
DROP TRIGGER IF EXISTS assign_rep_anonymous_id_trigger ON public.rep_profile;
CREATE TRIGGER assign_rep_anonymous_id_trigger
  BEFORE INSERT ON public.rep_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_rep_anonymous_id();

DROP TRIGGER IF EXISTS assign_vendor_anonymous_id_trigger ON public.vendor_profile;
CREATE TRIGGER assign_vendor_anonymous_id_trigger
  BEFORE INSERT ON public.vendor_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_vendor_anonymous_id();

-- 7. Add unique constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rep_profile_anonymous_id_key'
  ) THEN
    ALTER TABLE public.rep_profile ADD CONSTRAINT rep_profile_anonymous_id_key UNIQUE (anonymous_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vendor_profile_anonymous_id_key'
  ) THEN
    ALTER TABLE public.vendor_profile ADD CONSTRAINT vendor_profile_anonymous_id_key UNIQUE (anonymous_id);
  END IF;
END $$;

-- 8. Update column defaults to use sequences
ALTER TABLE public.rep_profile 
  ALTER COLUMN anonymous_id SET DEFAULT ('FieldRep#'::text || nextval('fieldrep_anon_seq'::regclass));

ALTER TABLE public.vendor_profile 
  ALTER COLUMN anonymous_id SET DEFAULT ('Vendor#'::text || nextval('vendor_anon_seq'::regclass));

-- 9. Add comments for documentation
COMMENT ON COLUMN public.rep_profile.anonymous_id IS 'Sequential anonymous identifier (FieldRep#1, FieldRep#2, etc.) assigned via fieldrep_anon_seq';
COMMENT ON COLUMN public.vendor_profile.anonymous_id IS 'Sequential anonymous identifier (Vendor#1, Vendor#2, etc.) assigned via vendor_anon_seq';
COMMENT ON SEQUENCE public.fieldrep_anon_seq IS 'Sequence for generating sequential Field Rep anonymous IDs';
COMMENT ON SEQUENCE public.vendor_anon_seq IS 'Sequence for generating sequential Vendor anonymous IDs';