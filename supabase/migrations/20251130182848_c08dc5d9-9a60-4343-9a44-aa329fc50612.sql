-- Create enums for vendor connections
CREATE TYPE public.vendor_connection_status AS ENUM ('pending', 'connected', 'declined', 'blocked');
CREATE TYPE public.vendor_connection_initiator AS ENUM ('vendor', 'field_rep');

-- Create vendor_connections table
CREATE TABLE public.vendor_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.vendor_connection_status NOT NULL DEFAULT 'pending',
  requested_by public.vendor_connection_initiator NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_connections IS 'Tracks vendor-to-field-rep connection requests and status';

-- Add unique constraint to prevent duplicate connections
CREATE UNIQUE INDEX vendor_connections_unique_pair ON public.vendor_connections(vendor_id, field_rep_id);

-- Add trigger for updated_at
CREATE TRIGGER update_vendor_connections_updated_at
  BEFORE UPDATE ON public.vendor_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.vendor_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vendor connections"
  ON public.vendor_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = vendor_id OR auth.uid() = field_rep_id);

CREATE POLICY "Vendors can create connection requests"
  ON public.vendor_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = vendor_id 
    AND requested_by = 'vendor'
  );

CREATE POLICY "Participants can update vendor connections"
  ON public.vendor_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendor_id OR auth.uid() = field_rep_id)
  WITH CHECK (auth.uid() = vendor_id OR auth.uid() = field_rep_id);