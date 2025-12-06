-- Working Terms Requests table
CREATE TABLE public.working_terms_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id),
  rep_id UUID NOT NULL REFERENCES public.profiles(id),
  requested_states TEXT[] NOT NULL DEFAULT '{}',
  requested_counties TEXT[] DEFAULT NULL,
  message_from_vendor TEXT,
  status TEXT NOT NULL DEFAULT 'pending_rep' CHECK (status IN ('pending_rep', 'pending_vendor', 'pending_rep_confirm', 'active', 'declined')),
  decline_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Working Terms Rows table (one row per state/county/inspection_type combination)
CREATE TABLE public.working_terms_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  working_terms_request_id UUID NOT NULL REFERENCES public.working_terms_requests(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id),
  rep_id UUID NOT NULL REFERENCES public.profiles(id),
  state_code TEXT NOT NULL,
  county_name TEXT,
  inspection_type TEXT NOT NULL,
  rate NUMERIC,
  turnaround_days INTEGER,
  source TEXT NOT NULL DEFAULT 'from_profile' CHECK (source IN ('from_profile', 'added_by_vendor', 'added_by_rep')),
  included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.working_terms_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_terms_rows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for working_terms_requests
CREATE POLICY "Users can view their own working terms requests"
ON public.working_terms_requests
FOR SELECT
USING (auth.uid() = vendor_id OR auth.uid() = rep_id);

CREATE POLICY "Vendors can create working terms requests"
ON public.working_terms_requests
FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Participants can update their working terms requests"
ON public.working_terms_requests
FOR UPDATE
USING (auth.uid() = vendor_id OR auth.uid() = rep_id);

-- RLS Policies for working_terms_rows
CREATE POLICY "Users can view their own working terms rows"
ON public.working_terms_rows
FOR SELECT
USING (auth.uid() = vendor_id OR auth.uid() = rep_id);

CREATE POLICY "Participants can insert working terms rows"
ON public.working_terms_rows
FOR INSERT
WITH CHECK (auth.uid() = vendor_id OR auth.uid() = rep_id);

CREATE POLICY "Participants can update working terms rows"
ON public.working_terms_rows
FOR UPDATE
USING (auth.uid() = vendor_id OR auth.uid() = rep_id);

CREATE POLICY "Participants can delete working terms rows"
ON public.working_terms_rows
FOR DELETE
USING (auth.uid() = vendor_id OR auth.uid() = rep_id);

-- Indexes for performance
CREATE INDEX idx_working_terms_requests_vendor_id ON public.working_terms_requests(vendor_id);
CREATE INDEX idx_working_terms_requests_rep_id ON public.working_terms_requests(rep_id);
CREATE INDEX idx_working_terms_requests_status ON public.working_terms_requests(status);
CREATE INDEX idx_working_terms_rows_request_id ON public.working_terms_rows(working_terms_request_id);

-- Update trigger for updated_at
CREATE TRIGGER update_working_terms_requests_updated_at
BEFORE UPDATE ON public.working_terms_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_working_terms_rows_updated_at
BEFORE UPDATE ON public.working_terms_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove old working_terms column from vendor_rep_agreements (replacing with new flow)
ALTER TABLE public.vendor_rep_agreements DROP COLUMN IF EXISTS working_terms;