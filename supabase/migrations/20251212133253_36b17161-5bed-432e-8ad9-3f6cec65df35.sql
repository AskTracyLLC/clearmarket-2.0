-- Create vendor_staff_emails table for staff email recipients
CREATE TABLE public.vendor_staff_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profile(id) ON DELETE CASCADE,
  staff_name TEXT,
  email TEXT NOT NULL,
  role_label TEXT,
  receive_network_alerts BOOLEAN NOT NULL DEFAULT true,
  receive_direct_messages BOOLEAN NOT NULL DEFAULT true,
  applies_to_all_states BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_staff_state_coverage table for staff → states mapping
CREATE TABLE public.vendor_staff_state_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_staff_email_id UUID NOT NULL REFERENCES public.vendor_staff_emails(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_staff_email_id, state_code)
);

-- Enable RLS on both tables
ALTER TABLE public.vendor_staff_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_staff_state_coverage ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user owns a vendor profile
CREATE OR REPLACE FUNCTION public.get_user_vendor_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendor_profile WHERE user_id = p_user_id LIMIT 1
$$;

-- RLS policies for vendor_staff_emails
CREATE POLICY "Vendors can view own staff emails"
  ON public.vendor_staff_emails
  FOR SELECT
  USING (vendor_profile_id = get_user_vendor_profile_id(auth.uid()) OR is_admin_user(auth.uid()));

CREATE POLICY "Vendors can insert own staff emails"
  ON public.vendor_staff_emails
  FOR INSERT
  WITH CHECK (vendor_profile_id = get_user_vendor_profile_id(auth.uid()));

CREATE POLICY "Vendors can update own staff emails"
  ON public.vendor_staff_emails
  FOR UPDATE
  USING (vendor_profile_id = get_user_vendor_profile_id(auth.uid()))
  WITH CHECK (vendor_profile_id = get_user_vendor_profile_id(auth.uid()));

CREATE POLICY "Vendors can delete own staff emails"
  ON public.vendor_staff_emails
  FOR DELETE
  USING (vendor_profile_id = get_user_vendor_profile_id(auth.uid()));

CREATE POLICY "Admins can manage all staff emails"
  ON public.vendor_staff_emails
  FOR ALL
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- RLS policies for vendor_staff_state_coverage
-- Users can manage state coverage for their own staff
CREATE POLICY "Vendors can view own staff state coverage"
  ON public.vendor_staff_state_coverage
  FOR SELECT
  USING (
    vendor_staff_email_id IN (
      SELECT id FROM public.vendor_staff_emails 
      WHERE vendor_profile_id = get_user_vendor_profile_id(auth.uid())
    )
    OR is_admin_user(auth.uid())
  );

CREATE POLICY "Vendors can insert own staff state coverage"
  ON public.vendor_staff_state_coverage
  FOR INSERT
  WITH CHECK (
    vendor_staff_email_id IN (
      SELECT id FROM public.vendor_staff_emails 
      WHERE vendor_profile_id = get_user_vendor_profile_id(auth.uid())
    )
  );

CREATE POLICY "Vendors can update own staff state coverage"
  ON public.vendor_staff_state_coverage
  FOR UPDATE
  USING (
    vendor_staff_email_id IN (
      SELECT id FROM public.vendor_staff_emails 
      WHERE vendor_profile_id = get_user_vendor_profile_id(auth.uid())
    )
  )
  WITH CHECK (
    vendor_staff_email_id IN (
      SELECT id FROM public.vendor_staff_emails 
      WHERE vendor_profile_id = get_user_vendor_profile_id(auth.uid())
    )
  );

CREATE POLICY "Vendors can delete own staff state coverage"
  ON public.vendor_staff_state_coverage
  FOR DELETE
  USING (
    vendor_staff_email_id IN (
      SELECT id FROM public.vendor_staff_emails 
      WHERE vendor_profile_id = get_user_vendor_profile_id(auth.uid())
    )
  );

CREATE POLICY "Admins can manage all staff state coverage"
  ON public.vendor_staff_state_coverage
  FOR ALL
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_vendor_staff_emails_vendor_profile_id ON public.vendor_staff_emails(vendor_profile_id);
CREATE INDEX idx_vendor_staff_emails_is_active ON public.vendor_staff_emails(is_active) WHERE is_active = true;
CREATE INDEX idx_vendor_staff_state_coverage_staff_id ON public.vendor_staff_state_coverage(vendor_staff_email_id);
CREATE INDEX idx_vendor_staff_state_coverage_state_code ON public.vendor_staff_state_coverage(state_code);

-- Add updated_at trigger for vendor_staff_emails
CREATE TRIGGER update_vendor_staff_emails_updated_at
  BEFORE UPDATE ON public.vendor_staff_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();