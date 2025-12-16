-- Enforce role = 'field_rep' for vendor-owned checklist templates
CREATE OR REPLACE FUNCTION enforce_vendor_template_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a vendor-owned template, force role to 'field_rep'
  IF NEW.owner_type = 'vendor' THEN
    NEW.role := 'field_rep';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply on INSERT and UPDATE
DROP TRIGGER IF EXISTS enforce_vendor_template_role_trigger ON checklist_templates;
CREATE TRIGGER enforce_vendor_template_role_trigger
  BEFORE INSERT OR UPDATE ON checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION enforce_vendor_template_role();

-- Also update any existing vendor templates to field_rep (cleanup)
UPDATE checklist_templates
SET role = 'field_rep'
WHERE owner_type = 'vendor' AND role != 'field_rep';