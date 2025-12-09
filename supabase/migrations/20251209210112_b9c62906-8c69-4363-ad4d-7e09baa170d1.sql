-- Create inspection_type_options table
CREATE TABLE public.inspection_type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('Property Inspections', 'Loss / Insurance Claims (Appointment-based)', 'Commercial', 'Other')),
  description text NULL,
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('rep', 'vendor', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for updated_at
CREATE TRIGGER update_inspection_type_options_updated_at
  BEFORE UPDATE ON public.inspection_type_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.inspection_type_options ENABLE ROW LEVEL SECURITY;

-- Everyone can read active options
CREATE POLICY "Anyone can read active inspection type options"
  ON public.inspection_type_options
  FOR SELECT
  USING (is_active = true OR is_admin_user(auth.uid()));

-- Only admins can manage
CREATE POLICY "Admins can manage inspection type options"
  ON public.inspection_type_options
  FOR ALL
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- Seed initial data from common inspection types
INSERT INTO public.inspection_type_options (code, label, category, applies_to, sort_order) VALUES
  ('standard_exterior_occupancy', 'Standard Exterior Occupancy', 'Property Inspections', 'both', 10),
  ('full_interior_exterior', 'Full Interior/Exterior', 'Property Inspections', 'both', 20),
  ('condition_report', 'Condition Report', 'Property Inspections', 'both', 30),
  ('property_preservation', 'Property Preservation', 'Property Inspections', 'both', 40),
  ('bpo', 'BPO (Broker Price Opinion)', 'Property Inspections', 'both', 50),
  ('loss_draft', 'Loss Draft', 'Loss / Insurance Claims (Appointment-based)', 'both', 10),
  ('insurance_claim', 'Insurance Claim Inspection', 'Loss / Insurance Claims (Appointment-based)', 'both', 20),
  ('draw_inspection', 'Draw Inspection', 'Loss / Insurance Claims (Appointment-based)', 'both', 30),
  ('commercial_property', 'Commercial Property', 'Commercial', 'both', 10),
  ('multi_family', 'Multi-Family', 'Commercial', 'both', 20),
  ('industrial', 'Industrial', 'Commercial', 'both', 30),
  ('other', 'Other', 'Other', 'both', 100);