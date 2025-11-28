-- Create vendor message templates table
CREATE TABLE IF NOT EXISTS public.vendor_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  scope text NOT NULL DEFAULT 'seeking_coverage',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_message_templates IS 'Private message templates for vendors.';
COMMENT ON COLUMN public.vendor_message_templates.scope IS 'MVP: use ''seeking_coverage'' for templates intended for Seeking Coverage conversations.';

-- Enable RLS
ALTER TABLE public.vendor_message_templates ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER update_vendor_message_templates_updated_at
  BEFORE UPDATE ON public.vendor_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
CREATE POLICY "Vendors can view their own templates"
ON public.vendor_message_templates
FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can create their own templates"
ON public.vendor_message_templates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update their own templates"
ON public.vendor_message_templates
FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete their own templates"
ON public.vendor_message_templates
FOR DELETE
TO authenticated
USING (auth.uid() = vendor_id);