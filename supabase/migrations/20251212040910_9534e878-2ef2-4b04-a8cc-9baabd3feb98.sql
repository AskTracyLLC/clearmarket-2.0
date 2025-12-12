-- Create review_settings table for admin-configurable review settings
CREATE TABLE public.review_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_days_between_reviews integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for review logic)
CREATE POLICY "Anyone can read review settings"
ON public.review_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can manage review settings"
ON public.review_settings
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_review_settings_updated_at
BEFORE UPDATE ON public.review_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with default row
INSERT INTO public.review_settings (min_days_between_reviews) VALUES (30);