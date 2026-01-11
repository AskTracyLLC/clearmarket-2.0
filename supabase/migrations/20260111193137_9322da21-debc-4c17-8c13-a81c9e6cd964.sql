-- 1) Auto-flip Waiting → Under Review trigger
CREATE OR REPLACE FUNCTION public.auto_flip_waiting_on_vendor_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_category text;
  v_is_staff boolean;
  v_queue_item_id uuid;
  v_queue_status text;
  v_queue_metadata jsonb;
BEGIN
  SELECT category INTO v_conv_category
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_conv_category IS NULL OR NOT v_conv_category LIKE 'support:%' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.admin_users WHERE user_id = NEW.sender_id
    UNION ALL
    SELECT 1 FROM public.staff_users WHERE user_id = NEW.sender_id
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  SELECT id, status, COALESCE(metadata, '{}'::jsonb)
    INTO v_queue_item_id, v_queue_status, v_queue_metadata
  FROM public.support_queue_items
  WHERE conversation_id = NEW.conversation_id
    AND category = 'vendor_verification'
  LIMIT 1;

  IF v_queue_item_id IS NOT NULL
     AND v_queue_status = 'waiting'
     AND COALESCE((v_queue_metadata->>'awaiting_vendor_reply')::boolean, false) = true THEN

    UPDATE public.support_queue_items
    SET
      status = 'in_progress',
      metadata = v_queue_metadata
        || jsonb_build_object(
          'awaiting_vendor_reply', false,
          'awaiting_since', to_jsonb(NULL::timestamptz),
          'last_vendor_message_at', to_jsonb(now())
        ),
      updated_at = now()
    WHERE id = v_queue_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_flip_waiting_on_vendor_reply ON public.messages;
CREATE TRIGGER trg_auto_flip_waiting_on_vendor_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_flip_waiting_on_vendor_reply();

REVOKE EXECUTE ON FUNCTION public.auto_flip_waiting_on_vendor_reply() FROM PUBLIC;

-- 2) RPC for admin send message with waiting toggle (safer version)
CREATE OR REPLACE FUNCTION public.admin_send_vendor_verification_message(
  p_queue_item_id uuid,
  p_subject text,
  p_body text,
  p_vendor_reply_required boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_sender_id uuid := auth.uid();
  v_queue_category text;
  v_conversation_id uuid;
  v_vendor_user_id uuid;
  v_msg_id uuid;
  v_metadata jsonb;
BEGIN
  -- allowlist staff/admin only
  SELECT EXISTS(
    SELECT 1 FROM public.admin_users WHERE user_id = v_sender_id
    UNION ALL
    SELECT 1 FROM public.staff_users WHERE user_id = v_sender_id
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- pull queue item
  SELECT category, conversation_id, COALESCE(metadata, '{}'::jsonb)
    INTO v_queue_category, v_conversation_id, v_metadata
  FROM public.support_queue_items
  WHERE id = p_queue_item_id;

  IF v_queue_category IS NULL THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;

  IF v_queue_category <> 'vendor_verification' THEN
    RAISE EXCEPTION 'Queue item is not vendor_verification';
  END IF;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Queue item has no conversation_id (create support conversation first)';
  END IF;

  -- vendor user id from metadata (try user_id first, then vendor_user_id)
  BEGIN
    v_vendor_user_id := NULLIF((v_metadata->>'user_id')::uuid, NULL);
  EXCEPTION WHEN others THEN
    v_vendor_user_id := NULL;
  END;

  IF v_vendor_user_id IS NULL THEN
    BEGIN
      v_vendor_user_id := NULLIF((v_metadata->>'vendor_user_id')::uuid, NULL);
    EXCEPTION WHEN others THEN
      v_vendor_user_id := NULL;
    END;
  END IF;

  IF v_vendor_user_id IS NULL THEN
    RAISE EXCEPTION 'Vendor user_id not found in metadata';
  END IF;

  -- insert message
  INSERT INTO public.messages (
    sender_id,
    recipient_id,
    subject,
    body,
    read,
    conversation_id
  ) VALUES (
    v_sender_id,
    v_vendor_user_id,
    COALESCE(p_subject, ''),
    COALESCE(p_body, ''),
    false,
    v_conversation_id
  )
  RETURNING id INTO v_msg_id;

  -- update queue item status + metadata
  UPDATE public.support_queue_items
  SET
    status = CASE WHEN p_vendor_reply_required THEN 'waiting' ELSE 'in_progress' END,
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'awaiting_vendor_reply', p_vendor_reply_required,
        'awaiting_since', CASE WHEN p_vendor_reply_required THEN to_jsonb(now()) ELSE to_jsonb(NULL::timestamptz) END,
        'last_admin_message_at', to_jsonb(now()),
        'last_admin_message_id', to_jsonb(v_msg_id)
      ),
    updated_at = now()
  WHERE id = p_queue_item_id;

  RETURN v_msg_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_send_vendor_verification_message(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_vendor_verification_message(uuid, text, text, boolean) TO authenticated;

-- 3) Add second_look columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_queue_items' AND column_name='second_look_requested_by'
  ) THEN
    ALTER TABLE public.support_queue_items
      ADD COLUMN second_look_requested_by uuid REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_queue_items' AND column_name='second_look_requested_at'
  ) THEN
    ALTER TABLE public.support_queue_items
      ADD COLUMN second_look_requested_at timestamptz;
  END IF;
END $$;