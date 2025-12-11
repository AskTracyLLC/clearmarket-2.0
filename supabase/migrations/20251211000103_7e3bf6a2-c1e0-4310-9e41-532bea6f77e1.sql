-- Add image_urls column to community_posts
ALTER TABLE public.community_posts
ADD COLUMN image_urls text[] DEFAULT '{}';

-- Create storage bucket for community post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-post-images', 'community-post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
-- Authenticated users can upload images
CREATE POLICY "Authenticated users can upload community images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-post-images');

-- Anyone can view community images (public bucket)
CREATE POLICY "Anyone can view community images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'community-post-images');

-- Users can delete their own uploaded images
CREATE POLICY "Users can delete own community images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'community-post-images' AND auth.uid()::text = (storage.foldername(name))[1]);