-- Add systems column to vendor_offline_rep_contacts
ALTER TABLE public.vendor_offline_rep_contacts
ADD COLUMN IF NOT EXISTS systems text[] NULL;

-- Update status check constraint on vendor_offline_rep_contacts to include 'blocked'
ALTER TABLE public.vendor_offline_rep_contacts
  DROP CONSTRAINT IF EXISTS vendor_offline_rep_contacts_status_check;

ALTER TABLE public.vendor_offline_rep_contacts
  ADD CONSTRAINT vendor_offline_rep_contacts_status_check
  CHECK (status IN ('active', 'inactive', 'blocked'));

-- Create field_rep_offline_vendor_contacts table
CREATE TABLE IF NOT EXISTS public.field_rep_offline_vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  company text NULL,
  email text NULL,
  phone text NULL,
  systems text[] NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add status check constraint for field_rep_offline_vendor_contacts (idempotent)
ALTER TABLE public.field_rep_offline_vendor_contacts
  DROP CONSTRAINT IF EXISTS field_rep_offline_vendor_contacts_status_check;

ALTER TABLE public.field_rep_offline_vendor_contacts
  ADD CONSTRAINT field_rep_offline_vendor_contacts_status_check
  CHECK (status IN ('active', 'inactive', 'blocked'));

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_vendor_offline_rep_contacts_vendor_id
  ON public.vendor_offline_rep_contacts (vendor_id);

CREATE INDEX IF NOT EXISTS idx_field_rep_offline_vendor_contacts_field_rep_id
  ON public.field_rep_offline_vendor_contacts (field_rep_id);

-- Email expression indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_vendor_offline_rep_contacts_vendor_email
  ON public.vendor_offline_rep_contacts (vendor_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_rep_offline_vendor_contacts_rep_email
  ON public.field_rep_offline_vendor_contacts (field_rep_id, lower(email))
  WHERE email IS NOT NULL;

-- Phone indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_vendor_offline_rep_contacts_vendor_phone
  ON public.vendor_offline_rep_contacts (vendor_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_rep_offline_vendor_contacts_rep_phone
  ON public.field_rep_offline_vendor_contacts (field_rep_id, phone)
  WHERE phone IS NOT NULL;

-- Create updated_at trigger (idempotent)
DROP TRIGGER IF EXISTS update_field_rep_offline_vendor_contacts_updated_at
  ON public.field_rep_offline_vendor_contacts;

CREATE TRIGGER update_field_rep_offline_vendor_contacts_updated_at
  BEFORE UPDATE ON public.field_rep_offline_vendor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.field_rep_offline_vendor_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for field_rep_offline_vendor_contacts
DROP POLICY IF EXISTS "Field reps can view their own offline vendor contacts" ON public.field_rep_offline_vendor_contacts;
CREATE POLICY "Field reps can view their own offline vendor contacts"
  ON public.field_rep_offline_vendor_contacts
  FOR SELECT
  USING (field_rep_id = auth.uid());

DROP POLICY IF EXISTS "Field reps can insert their own offline vendor contacts" ON public.field_rep_offline_vendor_contacts;
CREATE POLICY "Field reps can insert their own offline vendor contacts"
  ON public.field_rep_offline_vendor_contacts
  FOR INSERT
  WITH CHECK (field_rep_id = auth.uid());

DROP POLICY IF EXISTS "Field reps can update their own offline vendor contacts" ON public.field_rep_offline_vendor_contacts;
CREATE POLICY "Field reps can update their own offline vendor contacts"
  ON public.field_rep_offline_vendor_contacts
  FOR UPDATE
  USING (field_rep_id = auth.uid())
  WITH CHECK (field_rep_id = auth.uid());

DROP POLICY IF EXISTS "Field reps can delete their own offline vendor contacts" ON public.field_rep_offline_vendor_contacts;
CREATE POLICY "Field reps can delete their own offline vendor contacts"
  ON public.field_rep_offline_vendor_contacts
  FOR DELETE
  USING (field_rep_id = auth.uid());

-- Add to realtime publication (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.field_rep_offline_vendor_contacts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END$$;