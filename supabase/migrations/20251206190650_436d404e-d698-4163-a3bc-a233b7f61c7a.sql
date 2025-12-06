-- Add effective_from, status, and inactivation columns to working_terms_rows
ALTER TABLE public.working_terms_rows 
ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS inactivated_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS inactivated_by UUID NULL REFERENCES public.profiles(id);

-- Add check constraint for valid status values
ALTER TABLE public.working_terms_rows 
ADD CONSTRAINT working_terms_rows_status_check 
CHECK (status IN ('active', 'inactive', 'pending_change_vendor', 'pending_change_rep'));

-- Create working_terms_change_requests table for rate/turnaround negotiations
CREATE TABLE IF NOT EXISTS public.working_terms_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  working_terms_row_id UUID NOT NULL REFERENCES public.working_terms_rows(id) ON DELETE CASCADE,
  requested_by_role TEXT NOT NULL CHECK (requested_by_role IN ('vendor', 'rep')),
  requested_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  old_rate NUMERIC NULL,
  new_rate NUMERIC NULL,
  old_turnaround_days INTEGER NULL,
  new_turnaround_days INTEGER NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  decline_reason TEXT NULL,
  responded_by_user_id UUID NULL REFERENCES public.profiles(id),
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on working_terms_change_requests
ALTER TABLE public.working_terms_change_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view change requests they are part of (via the working terms row)
CREATE POLICY "Users can view own change requests" ON public.working_terms_change_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.working_terms_rows wtr
    WHERE wtr.id = working_terms_row_id
    AND (wtr.vendor_id = auth.uid() OR wtr.rep_id = auth.uid())
  )
);

-- Policy: Users can create change requests for their own working terms rows
CREATE POLICY "Users can create change requests" ON public.working_terms_change_requests
FOR INSERT WITH CHECK (
  requested_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.working_terms_rows wtr
    WHERE wtr.id = working_terms_row_id
    AND (wtr.vendor_id = auth.uid() OR wtr.rep_id = auth.uid())
  )
);

-- Policy: Users can update change requests they are part of
CREATE POLICY "Users can update change requests" ON public.working_terms_change_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.working_terms_rows wtr
    WHERE wtr.id = working_terms_row_id
    AND (wtr.vendor_id = auth.uid() OR wtr.rep_id = auth.uid())
  )
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_working_terms_change_requests_row_id 
ON public.working_terms_change_requests(working_terms_row_id);

CREATE INDEX IF NOT EXISTS idx_working_terms_change_requests_status 
ON public.working_terms_change_requests(status);

-- Add trigger to update updated_at
CREATE TRIGGER update_working_terms_change_requests_updated_at
BEFORE UPDATE ON public.working_terms_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index on working_terms_rows status
CREATE INDEX IF NOT EXISTS idx_working_terms_rows_status 
ON public.working_terms_rows(status);