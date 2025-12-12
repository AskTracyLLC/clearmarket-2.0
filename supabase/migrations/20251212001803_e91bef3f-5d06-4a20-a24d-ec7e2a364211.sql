-- Create territory_assignments table for tracking vendor-to-rep territory assignment workflow
CREATE TABLE public.territory_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id),
  rep_id UUID NOT NULL REFERENCES public.profiles(id),
  seeking_coverage_post_id UUID REFERENCES public.seeking_coverage_posts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  
  -- Territory details
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  county_id UUID REFERENCES public.us_counties(id),
  county_name TEXT,
  
  -- Work type / inspection info
  inspection_types TEXT[] DEFAULT '{}',
  systems_required TEXT[] DEFAULT '{}',
  
  -- Agreement terms
  agreed_rate NUMERIC NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_rep' CHECK (status IN ('pending_rep', 'active', 'declined')),
  decline_reason TEXT,
  
  -- Audit trail
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  vendor_confirmed_at TIMESTAMP WITH TIME ZONE,
  rep_confirmed_at TIMESTAMP WITH TIME ZONE,
  rep_confirmed_by UUID REFERENCES public.profiles(id),
  source TEXT NOT NULL DEFAULT 'seeking_coverage_assignment',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create partial unique index to prevent duplicate active assignments for same territory
CREATE UNIQUE INDEX idx_territory_assignments_unique_active 
  ON public.territory_assignments(vendor_id, rep_id, state_code, COALESCE(county_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Vendors can view their own territory assignments"
  ON public.territory_assignments FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "Reps can view territory assignments for them"
  ON public.territory_assignments FOR SELECT
  USING (auth.uid() = rep_id);

CREATE POLICY "Vendors can create territory assignments"
  ON public.territory_assignments FOR INSERT
  WITH CHECK (auth.uid() = vendor_id AND auth.uid() = created_by);

CREATE POLICY "Vendors can update their pending assignments"
  ON public.territory_assignments FOR UPDATE
  USING (auth.uid() = vendor_id AND status = 'pending_rep');

CREATE POLICY "Reps can update assignments pending their confirmation"
  ON public.territory_assignments FOR UPDATE
  USING (auth.uid() = rep_id AND status = 'pending_rep');

CREATE POLICY "Staff can view all territory assignments"
  ON public.territory_assignments FOR SELECT
  USING (is_staff_user(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_territory_assignments_updated_at
  BEFORE UPDATE ON public.territory_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add new status fields to seeking_coverage_posts for tracking assignment state
ALTER TABLE public.seeking_coverage_posts 
  ADD COLUMN IF NOT EXISTS filled_by_rep_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS closed_reason TEXT,
  ADD COLUMN IF NOT EXISTS has_pending_assignment BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_territory_assignments_vendor_rep ON public.territory_assignments(vendor_id, rep_id);
CREATE INDEX idx_territory_assignments_status ON public.territory_assignments(status);
CREATE INDEX idx_territory_assignments_post ON public.territory_assignments(seeking_coverage_post_id);
CREATE INDEX idx_seeking_coverage_posts_filled_by ON public.seeking_coverage_posts(filled_by_rep_id);