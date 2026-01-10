-- =============================================================
-- A) SCHEMA CHANGES: conversation link, action log, 2nd look
-- =============================================================

-- 1) Add conversation_id to support_queue_items
ALTER TABLE public.support_queue_items
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_queue_items_conversation_id
ON public.support_queue_items (conversation_id)
WHERE conversation_id IS NOT NULL;

-- 2) Add 2nd look fields to support_queue_items
ALTER TABLE public.support_queue_items
ADD COLUMN IF NOT EXISTS second_look_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS second_look_requested_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS second_look_note text;

-- 3) Add category column to conversations for support thread classification
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_conversations_category ON public.conversations(category) WHERE category IS NOT NULL;

-- 4) Create support_queue_actions table for action/message logging
CREATE TABLE IF NOT EXISTS public.support_queue_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.support_queue_items(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- message_sent, message_received, status_changed, second_look_requested, assigned, note
  channel text NOT NULL DEFAULT 'in_app', -- in_app, email
  direction text, -- outbound, inbound (for messages)
  body text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_queue_actions_queue_item_id ON public.support_queue_actions(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_support_queue_actions_created_at ON public.support_queue_actions(created_at DESC);

-- 5) Enable RLS on support_queue_actions
ALTER TABLE public.support_queue_actions ENABLE ROW LEVEL SECURITY;

-- Staff can read all actions
CREATE POLICY "Staff can view support queue actions"
ON public.support_queue_actions
FOR SELECT
TO authenticated
USING (public.is_staff_user(auth.uid()));

-- Staff can insert actions
CREATE POLICY "Staff can create support queue actions"
ON public.support_queue_actions
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_user(auth.uid()));

-- System/triggers can insert (for inbound message logging)
CREATE POLICY "System can insert support queue actions"
ON public.support_queue_actions
FOR INSERT
TO authenticated
WITH CHECK (current_user IN ('postgres', 'supabase_admin'));

-- =============================================================
-- 6) TRIGGER: Log inbound messages to support conversations
-- =============================================================
CREATE OR REPLACE FUNCTION public.log_inbound_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_item_id uuid;
BEGIN
  -- Check if this message is in a support conversation linked to a queue item
  SELECT sqi.id INTO v_queue_item_id
  FROM public.support_queue_items sqi
  WHERE sqi.conversation_id = NEW.conversation_id
  LIMIT 1;

  IF v_queue_item_id IS NOT NULL THEN
    -- Log the inbound message
    INSERT INTO public.support_queue_actions (
      queue_item_id,
      action_type,
      channel,
      direction,
      body,
      created_by,
      message_id
    ) VALUES (
      v_queue_item_id,
      'message_received',
      'in_app',
      'inbound',
      LEFT(NEW.body, 500),
      NEW.sender_id,
      NEW.id
    );

    -- Update queue item timestamp
    UPDATE public.support_queue_items
    SET updated_at = now()
    WHERE id = v_queue_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_inbound_support_message ON public.messages;
CREATE TRIGGER trg_log_inbound_support_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_inbound_support_message();

-- =============================================================
-- 7) UPDATE sync_vendor_verification_to_queue to create/link conversation
-- =============================================================
CREATE OR REPLACE FUNCTION public.sync_vendor_verification_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_preview TEXT;
  v_priority TEXT := 'normal';
  v_status TEXT;
  v_vendor_name TEXT;
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
  v_resolved_by uuid;
  v_conversation_id uuid;
  v_system_user_id uuid;
  v_queue_item_id uuid;
BEGIN
  -- FK-safe actor
  SELECT p.id INTO v_actor_profile FROM public.profiles p WHERE p.id = v_actor;

  -- Only process status changes on UPDATE (INSERT always processes)
  IF TG_OP = 'UPDATE' AND OLD.vendor_verification_status IS NOT DISTINCT FROM NEW.vendor_verification_status THEN
    RETURN NEW;
  END IF;

  -- Vendor display name
  SELECT COALESCE(p.full_name, 'Unknown Vendor')
  INTO v_vendor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  v_title := 'Vendor Verification: ' || v_vendor_name;

  v_preview :=
    'Requested code: ' || COALESCE(NEW.vendor_public_code_requested, 'N/A') ||
    ' | POC: ' || COALESCE(NEW.poc_name, 'Not provided');

  -- Map vendor status to queue status
  v_status := CASE NEW.vendor_verification_status
    WHEN 'pending' THEN 'open'
    WHEN 'needs_review' THEN 'waiting'
    WHEN 'verified' THEN 'resolved'
    WHEN 'rejected' THEN 'resolved'
    WHEN 'suspended' THEN 'resolved'
    ELSE 'open'
  END;

  -- Get or find system user for support conversations (first admin)
  SELECT id INTO v_system_user_id
  FROM public.profiles
  WHERE is_admin = true
  ORDER BY created_at
  LIMIT 1;

  -- Only create/update queue items for actionable statuses
  IF NEW.vendor_verification_status IN ('pending', 'needs_review') THEN
    
    -- Find or create a support conversation for this vendor verification
    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    WHERE c.category = 'support:vendor_verification'
      AND (
        (c.participant_one = NEW.user_id AND c.participant_two = v_system_user_id)
        OR (c.participant_one = v_system_user_id AND c.participant_two = NEW.user_id)
      )
    LIMIT 1;

    IF v_conversation_id IS NULL AND v_system_user_id IS NOT NULL THEN
      -- Create a new support conversation
      INSERT INTO public.conversations (
        participant_one,
        participant_two,
        category,
        conversation_type,
        origin_type,
        last_message_preview
      ) VALUES (
        LEAST(NEW.user_id, v_system_user_id),
        GREATEST(NEW.user_id, v_system_user_id),
        'support:vendor_verification',
        'support',
        'support',
        'Vendor Verification Request'
      )
      RETURNING id INTO v_conversation_id;
    END IF;

    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      conversation_id,
      created_at, updated_at
    ) VALUES (
      'vendor_verification',
      'vendor_profile',
      NEW.id,
      v_title,
      v_preview,
      v_priority,
      v_status,
      '/admin/support-queue?category=vendor_verification',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'requested_code', NEW.vendor_public_code_requested,
        'poc_name', NEW.poc_name,
        'poc_email', NEW.poc_email,
        'submitted_at', NEW.verification_submitted_at
      ),
      v_conversation_id,
      COALESCE(NEW.verification_submitted_at, now()),
      now()
    )
    ON CONFLICT (source_type, source_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      preview = EXCLUDED.preview,
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      conversation_id = COALESCE(support_queue_items.conversation_id, EXCLUDED.conversation_id),
      updated_at = now()
    RETURNING id INTO v_queue_item_id;

    -- Log the status change as an action
    IF v_queue_item_id IS NOT NULL AND TG_OP = 'UPDATE' THEN
      INSERT INTO public.support_queue_actions (
        queue_item_id,
        action_type,
        channel,
        body,
        created_by
      ) VALUES (
        v_queue_item_id,
        'status_changed',
        'in_app',
        'Status changed to ' || NEW.vendor_verification_status,
        v_actor_profile
      );
    END IF;

  ELSIF NEW.vendor_verification_status IN ('verified', 'rejected', 'suspended') THEN
    -- FK-safe resolved_by
    SELECT p.id INTO v_resolved_by FROM public.profiles p WHERE p.id = NEW.verified_by;
    v_resolved_by := COALESCE(v_resolved_by, v_actor_profile);

    -- Get queue item id for logging
    SELECT id INTO v_queue_item_id
    FROM public.support_queue_items
    WHERE source_type = 'vendor_profile' AND source_id = NEW.id;

    UPDATE public.support_queue_items
    SET
      status = 'resolved',
      resolved_at = COALESCE(resolved_at, now()),
      resolved_by = COALESCE(resolved_by, v_resolved_by),
      updated_at = now()
    WHERE source_type = 'vendor_profile'
      AND source_id = NEW.id;

    -- Log resolution as an action
    IF v_queue_item_id IS NOT NULL THEN
      INSERT INTO public.support_queue_actions (
        queue_item_id,
        action_type,
        channel,
        body,
        created_by
      ) VALUES (
        v_queue_item_id,
        'status_changed',
        'in_app',
        'Verification ' || NEW.vendor_verification_status,
        v_resolved_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Grant execute to authenticated for trigger firing
GRANT EXECUTE ON FUNCTION public.log_inbound_support_message() TO authenticated;

-- Add vendor_verification to category enum if support_queue_items uses it
-- (Already handled by existing category constraint or lack thereof)