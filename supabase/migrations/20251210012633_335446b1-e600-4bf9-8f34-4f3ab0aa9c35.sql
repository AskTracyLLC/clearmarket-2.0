-- Create background checks review table
CREATE TABLE public.background_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  check_id text NOT NULL,
  expiration_date date,
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by_user_id uuid REFERENCES public.profiles(id),
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (field_rep_id)
);

-- Enable RLS
ALTER TABLE public.background_checks ENABLE ROW LEVEL SECURITY;

-- Policies
-- Field reps can view and manage their own background check
CREATE POLICY "Reps can view own background check"
ON public.background_checks FOR SELECT
USING (auth.uid() = field_rep_id);

CREATE POLICY "Reps can insert own background check"
ON public.background_checks FOR INSERT
WITH CHECK (auth.uid() = field_rep_id);

CREATE POLICY "Reps can update own background check"
ON public.background_checks FOR UPDATE
USING (auth.uid() = field_rep_id);

-- Staff can view all background checks
CREATE POLICY "Staff can view all background checks"
ON public.background_checks FOR SELECT
USING (public.is_staff_user(auth.uid()));

-- Admins/moderators can update background checks (for review)
CREATE POLICY "Staff can update background checks"
ON public.background_checks FOR UPDATE
USING (public.is_staff_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_background_checks_updated_at
  BEFORE UPDATE ON public.background_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for status filtering
CREATE INDEX idx_background_checks_status ON public.background_checks(status);
CREATE INDEX idx_background_checks_field_rep_id ON public.background_checks(field_rep_id);