-- Drop the existing constraint
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_category_channel_check;

-- Recreate with faq added to announcements channel
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_category_channel_check CHECK (
  (channel = 'community' AND category IN ('question', 'general_discussion', 'safety')) OR
  (channel = 'network' AND category IN ('vendor_alert', 'rep_alert')) OR
  (channel = 'announcements' AND category IN ('system_news', 'release_updates', 'faq'))
);