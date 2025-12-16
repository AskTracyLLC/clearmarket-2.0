-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.enforce_vendor_template_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a vendor-owned template, force role to 'field_rep'
  IF NEW.owner_type = 'vendor' THEN
    NEW.role := 'field_rep';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;