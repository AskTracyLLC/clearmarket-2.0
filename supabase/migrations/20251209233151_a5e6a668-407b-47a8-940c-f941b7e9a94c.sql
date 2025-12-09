
-- Update the function to only notify users created before the announcement
CREATE OR REPLACE FUNCTION public.create_announcement_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_record RECORD;
  notif_title TEXT;
  notif_body TEXT;
BEGIN
  -- Only fire for announcements channel with specific categories
  IF NEW.channel = 'announcements' AND NEW.category IN ('system_news', 'release_updates', 'faq') THEN
    
    -- Determine notification title based on category
    CASE NEW.category
      WHEN 'system_news' THEN
        notif_title := 'New ClearMarket system announcement';
      WHEN 'release_updates' THEN
        notif_title := 'New ClearMarket release update';
      WHEN 'faq' THEN
        notif_title := 'New ClearMarket FAQ update';
      ELSE
        notif_title := 'New ClearMarket announcement';
    END CASE;
    
    -- Use post title if present, otherwise truncate body
    IF NEW.title IS NOT NULL AND NEW.title <> '' THEN
      notif_body := NEW.title;
    ELSE
      notif_body := LEFT(NEW.body, 150);
      IF LENGTH(NEW.body) > 150 THEN
        notif_body := notif_body || '…';
      END IF;
    END IF;
    
    -- Insert notification for each active user created BEFORE this announcement
    FOR user_record IN 
      SELECT id FROM public.profiles 
      WHERE account_status = 'active'
        AND (is_fieldrep = true OR is_vendor_admin = true)
        AND created_at < NEW.created_at
    LOOP
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        ref_id,
        is_read
      ) VALUES (
        user_record.id,
        'announcement',
        notif_title,
        notif_body,
        NEW.id,
        false
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Delete old backfill notifications (keep only today's)
DELETE FROM public.notifications 
WHERE type = 'announcement' 
AND ref_id IN (
  SELECT id FROM public.community_posts 
  WHERE channel = 'announcements' 
  AND created_at < CURRENT_DATE
);
