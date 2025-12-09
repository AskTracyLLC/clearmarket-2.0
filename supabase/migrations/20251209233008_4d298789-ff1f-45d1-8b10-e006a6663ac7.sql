-- Create the trigger (was missing)
DROP TRIGGER IF EXISTS trigger_create_announcement_notifications ON public.community_posts;

CREATE TRIGGER trigger_create_announcement_notifications
  AFTER INSERT ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_announcement_notifications();

-- Backfill notifications for existing announcement posts
INSERT INTO public.notifications (user_id, type, title, body, ref_id, is_read)
SELECT 
  p.id AS user_id,
  'announcement' AS type,
  CASE cp.category
    WHEN 'system_news' THEN 'New ClearMarket system announcement'
    WHEN 'release_updates' THEN 'New ClearMarket release update'
    WHEN 'faq' THEN 'New ClearMarket FAQ update'
    ELSE 'New ClearMarket announcement'
  END AS title,
  cp.title AS body,
  cp.id AS ref_id,
  false AS is_read
FROM public.community_posts cp
CROSS JOIN public.profiles p
WHERE cp.channel = 'announcements'
  AND cp.category IN ('system_news', 'release_updates', 'faq')
  AND p.account_status = 'active'
  AND (p.is_fieldrep = true OR p.is_vendor_admin = true)
ON CONFLICT DO NOTHING;