-- Add channel column to community_posts with default 'community'
ALTER TABLE public.community_posts
ADD COLUMN channel text NOT NULL DEFAULT 'community';

-- Update existing category values to match new schema
-- Map old categories to new community categories
UPDATE public.community_posts
SET category = CASE
  WHEN category = 'question' THEN 'question'
  WHEN category = 'warning' THEN 'safety'
  WHEN category = 'experience' THEN 'general_discussion'
  WHEN category = 'info' THEN 'general_discussion'
  ELSE 'general_discussion'
END
WHERE channel = 'community';

-- Add check constraint for valid channel values
ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_channel_check CHECK (channel IN ('community', 'network', 'announcements'));

-- Add check constraint for valid category-channel combinations
ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_category_channel_check CHECK (
  (channel = 'community' AND category IN ('question', 'general_discussion', 'safety'))
  OR (channel = 'network' AND category IN ('vendor_alert', 'rep_alert'))
  OR (channel = 'announcements' AND category IN ('system_news', 'release_updates'))
);

-- Create index on channel for faster filtering
CREATE INDEX idx_community_posts_channel ON public.community_posts(channel);

-- RLS policy: Only admins/staff can INSERT announcements
CREATE POLICY "Only admins can create announcements"
ON public.community_posts
FOR INSERT
WITH CHECK (
  channel != 'announcements' 
  OR public.is_admin_user(auth.uid())
);

-- RLS policy: Only admins/staff can UPDATE announcements
CREATE POLICY "Only admins can update announcements"
ON public.community_posts
FOR UPDATE
USING (
  channel != 'announcements' 
  OR public.is_admin_user(auth.uid())
);