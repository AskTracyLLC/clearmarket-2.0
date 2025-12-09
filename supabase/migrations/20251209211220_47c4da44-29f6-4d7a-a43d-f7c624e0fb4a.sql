-- Create inspection_categories table
CREATE TABLE public.inspection_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_categories ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active categories (needed for profile forms before full auth)
CREATE POLICY "Anyone can read active inspection categories"
ON public.inspection_categories
FOR SELECT
USING (is_active = true OR is_admin_user(auth.uid()));

-- Only admins can manage categories
CREATE POLICY "Admins can manage inspection categories"
ON public.inspection_categories
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Seed with the 4 current categories
INSERT INTO public.inspection_categories (code, label, description, sort_order) VALUES
  ('PROPERTY', 'Property Inspections', 'Standard property inspection types', 10),
  ('LOSS_CLAIMS', 'Loss / Insurance Claims (Appointment-based)', 'Insurance and loss draft inspection types requiring appointments', 20),
  ('COMMERCIAL', 'Commercial', 'Commercial property inspections', 30),
  ('OTHER', 'Other', 'Other inspection types not covered by main categories', 40);

-- Add trigger for updated_at
CREATE TRIGGER update_inspection_categories_updated_at
  BEFORE UPDATE ON public.inspection_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key from inspection_type_options to inspection_categories
ALTER TABLE public.inspection_type_options
ADD COLUMN category_id uuid REFERENCES public.inspection_categories(id);

-- Update existing inspection_type_options to link to the new categories
UPDATE public.inspection_type_options
SET category_id = (SELECT id FROM public.inspection_categories WHERE label = inspection_type_options.category)
WHERE category_id IS NULL;