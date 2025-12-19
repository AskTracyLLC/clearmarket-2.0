-- Update send_admin_broadcast RPC to prevent duplicate notifications
CREATE OR REPLACE FUNCTION public.send_admin_broadcast(p_broadcast_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_broadcast RECORD;
  v_audience jsonb;
  v_roles text[];
  v_active_days int;
  v_recipient_count int := 0;
  v_notification_count int := 0;
  v_user RECORD;
  v_recipient_id uuid;
  v_notification_id uuid;
  v_existing_recipient_id uuid;
  v_existing_notification_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Get broadcast
  SELECT * INTO v_broadcast
  FROM public.admin_broadcasts
  WHERE id = p_broadcast_id
  FOR UPDATE;

  IF v_broadcast IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcast not found');
  END IF;

  IF v_broadcast.status NOT IN ('draft', 'scheduled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcast already sent or archived');
  END IF;

  -- Set status to sending
  UPDATE public.admin_broadcasts
  SET status = 'sending', updated_at = now()
  WHERE id = p_broadcast_id;

  -- Parse audience filters
  v_audience := v_broadcast.audience;
  
  -- Get roles filter (default to field_rep and vendor if not specified)
  IF v_audience ? 'roles' AND jsonb_array_length(v_audience->'roles') > 0 THEN
    SELECT array_agg(r::text) INTO v_roles
    FROM jsonb_array_elements_text(v_audience->'roles') r;
  ELSE
    v_roles := ARRAY['field_rep', 'vendor'];
  END IF;

  -- Get active_days filter
  v_active_days := COALESCE((v_audience->>'active_days')::int, NULL);

  -- Iterate through matching users and create recipients + notifications
  FOR v_user IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE p.account_status = 'active'
      AND p.is_admin = false
      AND (
        ('field_rep' = ANY(v_roles) AND p.is_fieldrep = true)
        OR ('vendor' = ANY(v_roles) AND p.is_vendor_admin = true)
      )
      AND (
        v_active_days IS NULL 
        OR p.last_seen_at IS NULL 
        OR p.last_seen_at >= (now() - (v_active_days || ' days')::interval)
      )
  LOOP
    -- Check if recipient already exists for this broadcast + user
    SELECT id INTO v_existing_recipient_id
    FROM public.admin_broadcast_recipients
    WHERE broadcast_id = p_broadcast_id AND user_id = v_user.id;

    IF v_existing_recipient_id IS NOT NULL THEN
      -- Already processed, skip
      CONTINUE;
    END IF;

    -- Check if notification already exists for this broadcast + user
    SELECT id INTO v_existing_notification_id
    FROM public.notifications
    WHERE type = 'admin_broadcast'
      AND ref_id = p_broadcast_id::text
      AND user_id = v_user.id;

    -- Insert recipient
    INSERT INTO public.admin_broadcast_recipients (broadcast_id, user_id)
    VALUES (p_broadcast_id, v_user.id)
    RETURNING id INTO v_recipient_id;

    v_recipient_count := v_recipient_count + 1;

    -- Reuse existing notification or create new one
    IF v_existing_notification_id IS NOT NULL THEN
      v_notification_id := v_existing_notification_id;
    ELSE
      -- Create in-app notification
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        ref_id,
        metadata
      ) VALUES (
        v_user.id,
        'admin_broadcast',
        v_broadcast.title,
        LEFT(v_broadcast.message_md, 200),
        p_broadcast_id::text,
        jsonb_build_object(
          'broadcast_id', p_broadcast_id,
          'cta_label', v_broadcast.cta_label,
          'cta_route', '/feedback/broadcast/' || p_broadcast_id::text
        )
      )
      RETURNING id INTO v_notification_id;

      v_notification_count := v_notification_count + 1;
    END IF;

    -- Link notification to recipient
    UPDATE public.admin_broadcast_recipients
    SET notification_id = v_notification_id
    WHERE id = v_recipient_id;
  END LOOP;

  -- Update broadcast status and stats
  UPDATE public.admin_broadcasts
  SET 
    status = 'sent',
    sent_at = now(),
    updated_at = now(),
    stats = jsonb_build_object(
      'sent', (SELECT COUNT(*) FROM public.admin_broadcast_recipients WHERE broadcast_id = p_broadcast_id),
      'responses', 0,
      'avg_rating', null
    )
  WHERE id = p_broadcast_id;

  RETURN jsonb_build_object(
    'success', true,
    'recipients_created', v_recipient_count,
    'notifications_created', v_notification_count
  );
END;
$function$;