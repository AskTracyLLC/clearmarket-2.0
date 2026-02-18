
-- Trigger function to keep both columns in sync (safe on INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.sync_vendor_bio_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.business_bio IS NULL AND NEW.company_description IS NOT NULL THEN
      NEW.business_bio := NEW.company_description;
    ELSIF NEW.company_description IS NULL AND NEW.business_bio IS NOT NULL THEN
      NEW.company_description := NEW.business_bio;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.business_bio IS DISTINCT FROM OLD.business_bio THEN
    NEW.company_description := NEW.business_bio;
  ELSIF NEW.company_description IS DISTINCT FROM OLD.company_description THEN
    NEW.business_bio := NEW.company_description;
  END IF;

  RETURN NEW;
END;
$$;

-- Idempotent trigger recreate
DROP TRIGGER IF EXISTS sync_vendor_bio_columns_trigger ON public.vendor_profile;

CREATE TRIGGER sync_vendor_bio_columns_trigger
BEFORE INSERT OR UPDATE ON public.vendor_profile
FOR EACH ROW
EXECUTE FUNCTION public.sync_vendor_bio_columns();
