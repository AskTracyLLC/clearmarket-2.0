-- Add image_urls column to support_tickets table
ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Create storage bucket for support attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for support-attachments bucket
CREATE POLICY "Authenticated users can upload support attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "Anyone can view support attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'support-attachments');

CREATE POLICY "Users can delete their own support attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);