-- Create enum for agreement status
CREATE TYPE public.vendor_rep_agreement_status AS ENUM ('active', 'paused', 'ended');

-- Create vendor_rep_agreements table
CREATE TABLE public.vendor_rep_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.vendor_rep_agreement_status NOT NULL DEFAULT 'active',
  coverage_summary TEXT,
  pricing_summary TEXT,
  base_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index on vendor-rep pair
CREATE UNIQUE INDEX vendor_rep_unique_pair ON public.vendor_rep_agreements(vendor_id, field_rep_id);

-- Enable RLS
ALTER TABLE public.vendor_rep_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Both parties can view their agreements
CREATE POLICY "Users can view their own agreements"
  ON public.vendor_rep_agreements
  FOR SELECT
  USING (
    auth.uid() = vendor_id OR auth.uid() = field_rep_id
  );

-- Only vendors can create agreements
CREATE POLICY "Vendors can create agreements"
  ON public.vendor_rep_agreements
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

-- Both parties can update their agreements
CREATE POLICY "Users can update their own agreements"
  ON public.vendor_rep_agreements
  FOR UPDATE
  USING (
    auth.uid() = vendor_id OR auth.uid() = field_rep_id
  );

-- Add trigger for updated_at
CREATE TRIGGER update_vendor_rep_agreements_updated_at
  BEFORE UPDATE ON public.vendor_rep_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.vendor_rep_agreements IS 'Tracks active working relationships between vendors and field reps with agreed coverage and pricing terms';