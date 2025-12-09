-- Create function to handle announcement notifications
CREATE OR REPLACE FUNCTION public.create_announcement_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    
    -- Insert notification for each active user (vendors and field reps)
    FOR user_record IN 
      SELECT id FROM public.profiles 
      WHERE account_status = 'active'
        AND (is_fieldrep = true OR is_vendor_admin = true)
    LOOP
      -- Use ON CONFLICT to ensure idempotency
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
$$;

-- Create trigger for announcement notifications
DROP TRIGGER IF EXISTS create_announcement_notifications_trigger ON public.community_posts;
CREATE TRIGGER create_announcement_notifications_trigger
  AFTER INSERT ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_announcement_notifications();

-- Add unique constraint to prevent duplicate announcement notifications per user
-- First check if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_user_announcement_unique'
  ) THEN
    -- Create a unique index instead of constraint for partial uniqueness
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_announcement_unique 
    ON public.notifications (user_id, type, ref_id) 
    WHERE type = 'announcement';
  END IF;
END $$;