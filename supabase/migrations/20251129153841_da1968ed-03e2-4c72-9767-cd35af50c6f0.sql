-- Create vendor_coverage_areas table
CREATE TABLE IF NOT EXISTS public.vendor_coverage_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  state_name text NOT NULL,
  county_id uuid NULL REFERENCES public.us_counties(id),
  county_name text NULL,
  covers_entire_state boolean NOT NULL DEFAULT false,
  covers_entire_county boolean NOT NULL DEFAULT false,
  region_note text NULL,
  inspection_types text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_coverage_areas IS
  'Coverage areas for vendors – states/counties they place work in. No pricing here.';

-- Add trigger for updated_at
CREATE TRIGGER update_vendor_coverage_areas_updated_at
  BEFORE UPDATE ON public.vendor_coverage_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.vendor_coverage_areas ENABLE ROW LEVEL SECURITY;

-- Vendor can manage their own coverage rows
CREATE POLICY "Vendors can manage their own coverage"
ON public.vendor_coverage_areas
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to read vendor coverage for matching / public profiles
CREATE POLICY "Authenticated users can view vendor coverage"
ON public.vendor_coverage_areas
FOR SELECT
TO authenticated
USING (true);