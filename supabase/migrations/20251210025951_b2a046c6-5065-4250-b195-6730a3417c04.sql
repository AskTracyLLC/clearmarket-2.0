-- Create enum for site page types
CREATE TYPE public.site_page_type AS ENUM ('tos', 'privacy', 'support');

-- Create site_pages table for single pages like ToS, Privacy, Support
CREATE TABLE public.site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type site_page_type NOT NULL UNIQUE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  effective_at TIMESTAMP WITH TIME ZONE,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_by UUID REFERENCES public.profiles(id),
  is_published BOOLEAN NOT NULL DEFAULT false,
  announced_on DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create help_center_articles table
CREATE TABLE public.help_center_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 100,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_center_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for site_pages
CREATE POLICY "Anyone can read published site pages"
ON public.site_pages
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage all site pages"
ON public.site_pages
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- RLS policies for help_center_articles
CREATE POLICY "Anyone can read published help articles"
ON public.help_center_articles
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage all help articles"
ON public.help_center_articles
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Create indexes
CREATE INDEX idx_site_pages_page_type ON public.site_pages(page_type);
CREATE INDEX idx_site_pages_is_published ON public.site_pages(is_published);
CREATE INDEX idx_help_center_articles_category ON public.help_center_articles(category);
CREATE INDEX idx_help_center_articles_is_published ON public.help_center_articles(is_published);
CREATE INDEX idx_help_center_articles_display_order ON public.help_center_articles(display_order);

-- Seed initial site pages (unpublished drafts)
INSERT INTO public.site_pages (page_type, title, slug, content, is_published)
VALUES 
  ('tos', 'Terms of Service', '/legal/terms', '', false),
  ('privacy', 'Privacy Policy', '/legal/privacy', '', false),
  ('support', 'Support', '/support', '', false);