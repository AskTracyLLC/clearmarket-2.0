-- Create connection_agreement_areas table for normalized agreement data
CREATE TABLE public.connection_agreement_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.vendor_connections(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  county_name text,
  zip_code text,
  inspection_type_id uuid REFERENCES public.inspection_type_options(id),
  inspection_category text,
  base_rate numeric,
  rush_rate numeric,
  effective_start date NOT NULL DEFAULT CURRENT_DATE,
  effective_end date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'inactive')),
  source_working_terms_row_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_connection_agreement_areas_connection_id ON public.connection_agreement_areas(connection_id);
CREATE INDEX idx_connection_agreement_areas_status ON public.connection_agreement_areas(status);

-- Enable RLS
ALTER TABLE public.connection_agreement_areas ENABLE ROW LEVEL SECURITY;

-- RLS: Reps and Vendors can read agreement rows for connections they are part of
CREATE POLICY "Users can view their own connection agreements"
ON public.connection_agreement_areas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_connections vc
    WHERE vc.id = connection_agreement_areas.connection_id
    AND (vc.vendor_id = auth.uid() OR vc.field_rep_id = auth.uid())
  )
);

-- RLS: Vendors can create agreement areas for their connections
CREATE POLICY "Vendors can create agreement areas"
ON public.connection_agreement_areas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_connections vc
    WHERE vc.id = connection_agreement_areas.connection_id
    AND vc.vendor_id = auth.uid()
  )
);

-- RLS: Users can update their own connection agreements
CREATE POLICY "Users can update their own connection agreements"
ON public.connection_agreement_areas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_connections vc
    WHERE vc.id = connection_agreement_areas.connection_id
    AND (vc.vendor_id = auth.uid() OR vc.field_rep_id = auth.uid())
  )
);

-- RLS: Admins can read all
CREATE POLICY "Staff can view all connection agreements"
ON public.connection_agreement_areas
FOR SELECT
USING (is_staff_user(auth.uid()));

-- Add connection_id and agreement_area_id to reviews table
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.vendor_connections(id),
ADD COLUMN IF NOT EXISTS agreement_area_id uuid REFERENCES public.connection_agreement_areas(id);

-- Create index for reviews by connection
CREATE INDEX IF NOT EXISTS idx_reviews_connection_id ON public.reviews(connection_id);
CREATE INDEX IF NOT EXISTS idx_reviews_agreement_area_id ON public.reviews(agreement_area_id);

-- Trigger to update updated_at on connection_agreement_areas
CREATE TRIGGER update_connection_agreement_areas_updated_at
BEFORE UPDATE ON public.connection_agreement_areas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();