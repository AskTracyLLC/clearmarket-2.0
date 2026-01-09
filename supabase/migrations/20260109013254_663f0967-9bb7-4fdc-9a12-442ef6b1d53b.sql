-- Create vendor_offline_rep_contacts table
CREATE TABLE public.vendor_offline_rep_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rep_name text NOT NULL,
  company text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_offline_rep_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Vendors can view their own offline rep contacts"
  ON public.vendor_offline_rep_contacts
  FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert their own offline rep contacts"
  ON public.vendor_offline_rep_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update their own offline rep contacts"
  ON public.vendor_offline_rep_contacts
  FOR UPDATE
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete their own offline rep contacts"
  ON public.vendor_offline_rep_contacts
  FOR DELETE
  USING (auth.uid() = vendor_id);

-- Unique partial indexes to prevent duplicates
CREATE UNIQUE INDEX vendor_offline_rep_contacts_email_idx
  ON public.vendor_offline_rep_contacts (vendor_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX vendor_offline_rep_contacts_phone_idx
  ON public.vendor_offline_rep_contacts (vendor_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- Trigger for updated_at
CREATE TRIGGER set_vendor_offline_rep_contacts_updated_at
  BEFORE UPDATE ON public.vendor_offline_rep_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();