-- Create rep_coverage_areas table for ClearMarket 2.0
-- This is the MVP coverage/pricing source of truth for future matching & Seeking Coverage logic
CREATE TABLE public.rep_coverage_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  state_name text NOT NULL,
  county_name text NULL,
  covers_entire_state boolean NOT NULL DEFAULT false,
  covers_entire_county boolean NOT NULL DEFAULT false,
  base_price numeric(10,2) NULL,
  rush_price numeric(10,2) NULL,
  inspection_types text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE public.rep_coverage_areas IS 'ClearMarket 2.0 coverage and pricing table - safe to build real logic on (not a placeholder)';

-- Enable RLS
ALTER TABLE public.rep_coverage_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Reps can only see and modify their own coverage areas
CREATE POLICY "Reps can manage their own coverage areas"
ON public.rep_coverage_areas
FOR ALL
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_rep_coverage_areas_updated_at
BEFORE UPDATE ON public.rep_coverage_areas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries by user_id and state
CREATE INDEX idx_rep_coverage_areas_user_id ON public.rep_coverage_areas(user_id);
CREATE INDEX idx_rep_coverage_areas_state ON public.rep_coverage_areas(state_code);