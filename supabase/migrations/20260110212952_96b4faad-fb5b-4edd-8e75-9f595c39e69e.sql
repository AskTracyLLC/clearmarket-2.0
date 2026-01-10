-- ========================================================
-- SUPPORT THREADS FOR VENDOR VERIFICATION (ONE-SHOT, FIXED)
-- (Corrected: internal notes are ADMIN/SUPER-ADMIN ONLY)
-- ========================================================

-- A1) Index on conversations.category (safe)
CREATE INDEX IF NOT EXISTS idx_conversations_category
ON public.conversations(category);

-- A2) De-dupe any existing support_queue_actions rows by message_id (safe)
DELETE FROM public.support_queue_actions a
USING public.support_queue_actions b
WHERE a.message_id IS NOT NULL
  AND b.message_id IS NOT NULL
  AND a.message_id = b.message_id
  AND a.id > b.id;

-- A3) Prevent double logging for the same message_id going forward
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_queue_actions_message_id_unique
ON public.support_queue_actions(message_id)
WHERE message_id IS NOT NULL;

-- A4) Internal notes table for admin/super-admin "2nd look"
CREATE TABLE IF NOT EXISTS public.support_queue_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.support_queue_items(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_queue_internal_notes_queue_item_id
ON public.support_queue_internal_notes(queue_item_id);

ALTER TABLE public.support_queue_internal_notes ENABLE ROW LEVEL SECURITY;

-- ADMIN/SUPER-ADMIN ONLY (not all staff)
DROP POLICY IF EXISTS "Admins can view internal notes" ON public.support_queue_internal_notes;
CREATE POLICY "Admins can view internal notes"
ON public.support_queue_internal_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin = true OR p.is_super_admin = true)
  )
);

DROP POLICY IF EXISTS "Admins can insert internal notes" ON public.support_queue_internal_notes;
CREATE POLICY "Admins can insert internal notes"
ON public.support_queue_internal_notes
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin = true OR p.is_super_admin = true)
  )
);

-- A5) Backfill function: link vendor_verification queue items to a support conversation
CREATE OR REPLACE FUNCTION public.backfill_vendor_verification_conversations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_created_count integer := 0;
  v_item record;
  v_vendor_user_id uuid;
  v_staff_user_id uuid;
  v_conversation_id uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_is_system boolean := (current_user IN ('postgres', 'supabase_admin'));
BEGIN
  IF NOT v_is_system AND NOT public.is_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO v_staff_user_id
  FROM public.profiles
  WHERE (is_admin = true OR is_support = true)
    AND account_status = 'active'
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;

  IF v_staff_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active admin/support user found', 'updated', 0, 'created', 0);
  END IF;

  FOR v_item IN
    SELECT sqi.id AS queue_id, sqi.source_id
    FROM public.support_queue_items sqi
    WHERE sqi.category = 'vendor_verification'
      AND sqi.source_type = 'vendor_profile'
      AND sqi.conversation_id IS NULL
  LOOP
    SELECT vp.user_id INTO v_vendor_user_id
    FROM public.vendor_profile vp
    WHERE vp.id::text = v_item.source_id::text;

    IF v_vendor_user_id IS NULL THEN
      CONTINUE;
    END IF;

    v_p1 := LEAST(v_vendor_user_id, v_staff_user_id);
    v_p2 := GREATEST(v_vendor_user_id, v_staff_user_id);

    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    WHERE c.participant_one = v_p1
      AND c.participant_two = v_p2
      AND c.category = 'support:vendor_verification'
    LIMIT 1;

    -- IMPORTANT: omit origin_type to avoid CHECK constraint; NULL passes CHECK
    IF v_conversation_id IS NULL THEN
      INSERT INTO public.conversations (
        participant_one,
        participant_two,
        conversation_type,
        category,
        last_message_preview,
        last_message_at
      ) VALUES (
        v_p1,
        v_p2,
        'direct',
        'support:vendor_verification',
        'Vendor Verification Support',
        now()
      )
      RETURNING id INTO v_conversation_id;

      v_created_count := v_created_count + 1;
    END IF;

    UPDATE public.support_queue_items
    SET conversation_id = v_conversation_id,
        updated_at = now()
    WHERE id = v_item.queue_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated_count,
    'created', v_created_count,
    'paired_staff_user_id', v_staff_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_vendor_verification_conversations() TO authenticated;

-- A6) Single-item link function for UI "Link Thread" button
CREATE OR REPLACE FUNCTION public.link_vendor_verification_conversation(p_queue_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_vendor_user_id uuid;
  v_staff_user_id uuid;
  v_conversation_id uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_is_system boolean := (current_user IN ('postgres', 'supabase_admin'));
BEGIN
  IF NOT v_is_system AND NOT public.is_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, source_id, source_type, category, conversation_id
  INTO v_item
  FROM public.support_queue_items
  WHERE id = p_queue_item_id;

  IF v_item IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
  END IF;

  IF v_item.category <> 'vendor_verification' OR v_item.source_type <> 'vendor_profile' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a vendor_verification item');
  END IF;

  IF v_item.conversation_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'conversation_id', v_item.conversation_id, 'already_linked', true);
  END IF;

  SELECT vp.user_id INTO v_vendor_user_id
  FROM public.vendor_profile vp
  WHERE vp.id::text = v_item.source_id::text;

  IF v_vendor_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendor profile not found');
  END IF;

  SELECT id INTO v_staff_user_id
  FROM public.profiles
  WHERE (is_admin = true OR is_support = true)
    AND account_status = 'active'
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;

  IF v_staff_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active admin/support user found');
  END IF;

  v_p1 := LEAST(v_vendor_user_id, v_staff_user_id);
  v_p2 := GREATEST(v_vendor_user_id, v_staff_user_id);

  SELECT c.id INTO v_conversation_id
  FROM public.conversations c
  WHERE c.participant_one = v_p1
    AND c.participant_two = v_p2
    AND c.category = 'support:vendor_verification'
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      participant_one,
      participant_two,
      conversation_type,
      category,
      last_message_preview,
      last_message_at
    ) VALUES (
      v_p1,
      v_p2,
      'direct',
      'support:vendor_verification',
      'Vendor Verification Support',
      now()
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  UPDATE public.support_queue_items
  SET conversation_id = v_conversation_id,
      updated_at = now()
  WHERE id = p_queue_item_id;

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_vendor_verification_conversation(uuid) TO authenticated;

-- A7) Fix message logging direction for support-linked conversations
CREATE OR REPLACE FUNCTION public.log_inbound_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_item_id uuid;
  v_is_staff boolean;
  v_action_type text;
  v_direction text;
BEGIN
  SELECT sqi.id INTO v_queue_item_id
  FROM public.support_queue_items sqi
  WHERE sqi.conversation_id = NEW.conversation_id
  LIMIT 1;

  IF v_queue_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_queue_actions a
    WHERE a.message_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_is_staff := public.is_staff_user(NEW.sender_id);

  IF v_is_staff THEN
    v_action_type := 'message_sent';
    v_direction := 'outbound';
  ELSE
    v_action_type := 'message_received';
    v_direction := 'inbound';
  END IF;

  INSERT INTO public.support_queue_actions (
    queue_item_id, action_type, channel, direction, body, created_by, message_id
  ) VALUES (
    v_queue_item_id, v_action_type, 'in_app', v_direction, LEFT(NEW.body, 500), NEW.sender_id, NEW.id
  );

  UPDATE public.support_queue_items
  SET updated_at = now()
  WHERE id = v_queue_item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_inbound_support_message ON public.messages;
CREATE TRIGGER trg_log_inbound_support_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.log_inbound_support_message();

-- A8) Staff can INSERT messages into support:* conversations
DROP POLICY IF EXISTS "Staff can send messages in support conversations" ON public.messages;
CREATE POLICY "Staff can send messages in support conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_staff_user(auth.uid())
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND c.category LIKE 'support:%'
      AND (recipient_id = c.participant_one OR recipient_id = c.participant_two)
      AND recipient_id <> sender_id
  )
);

-- A9) Run backfill now
SELECT public.backfill_vendor_verification_conversations();