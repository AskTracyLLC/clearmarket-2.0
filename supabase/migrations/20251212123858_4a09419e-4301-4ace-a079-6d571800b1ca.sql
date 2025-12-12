-- Create rep_vendor_contacts table for Field Reps to store off-platform vendor contacts
CREATE TABLE public.rep_vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_rep_vendor_contacts_rep_user_id ON public.rep_vendor_contacts(rep_user_id);
CREATE INDEX idx_rep_vendor_contacts_email ON public.rep_vendor_contacts(email);

-- Enable RLS
ALTER TABLE public.rep_vendor_contacts ENABLE ROW LEVEL SECURITY;

-- RLS: Field Reps can only see their own contacts
CREATE POLICY "Reps can view their own vendor contacts"
ON public.rep_vendor_contacts
FOR SELECT
USING (auth.uid() = rep_user_id);

-- RLS: Field Reps can insert their own contacts
CREATE POLICY "Reps can create their own vendor contacts"
ON public.rep_vendor_contacts
FOR INSERT
WITH CHECK (auth.uid() = rep_user_id);

-- RLS: Field Reps can update their own contacts
CREATE POLICY "Reps can update their own vendor contacts"
ON public.rep_vendor_contacts
FOR UPDATE
USING (auth.uid() = rep_user_id);

-- RLS: Field Reps can delete their own contacts
CREATE POLICY "Reps can delete their own vendor contacts"
ON public.rep_vendor_contacts
FOR DELETE
USING (auth.uid() = rep_user_id);

-- RLS: Admins can view all contacts
CREATE POLICY "Admins can view all vendor contacts"
ON public.rep_vendor_contacts
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_rep_vendor_contacts_updated_at
BEFORE UPDATE ON public.rep_vendor_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();