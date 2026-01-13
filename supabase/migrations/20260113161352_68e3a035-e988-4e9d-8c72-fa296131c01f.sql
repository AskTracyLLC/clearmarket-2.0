-- =============================================================
-- SUPPORT QUEUE: Add Cancelled status + Waiting automation fields
-- 48hr nudge, 96hr final nudge, 7-day auto-cancel (WAITING only)
-- =============================================================

-- 1) Update status CHECK constraint to include 'cancelled' (keep existing + open)
ALTER TABLE public.support_queue_items
  DROP CONSTRAINT IF EXISTS support_queue_items_status_check;

ALTER TABLE public.support_queue_items
  ADD CONSTRAINT support_queue_items_status_check
  CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'cancelled'));

-- 2) Add waiting automation fields
ALTER TABLE public.support_queue_items
  ADD COLUMN IF NOT EXISTS waiting_on_user_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_response_required_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS nudge_48_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nudge_96_sent_at TIMESTAMPTZ;

-- 3) Add response_required flag to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS response_required BOOLEAN NOT NULL DEFAULT false;

-- 4) Index for waiting automation queries (partial)
CREATE INDEX IF NOT EXISTS idx_support_queue_items_waiting_automation
  ON public.support_queue_items (waiting_on_user_since)
  WHERE status = 'waiting' AND waiting_on_user_since IS NOT NULL;

-- 5) Update event_type CHECK to include existing + new types (superset)
ALTER TABLE public.support_queue_item_events
  DROP CONSTRAINT IF EXISTS support_queue_item_events_event_type_check;

ALTER TABLE public.support_queue_item_events
  ADD CONSTRAINT support_queue_item_events_event_type_check
  CHECK (event_type IN (
    'assigned', 'created', 'resolved', 'status_changed',
    'cancelled', 'nudge_48_sent', 'nudge_96_sent', 'auto_cancelled'
  ));

-- 6) Update open counts view to exclude resolved/cancelled
CREATE OR REPLACE VIEW public.support_queue_open_counts_by_category AS
SELECT
  category,
  COUNT(*)::int AS open_count
FROM public.support_queue_items
WHERE status NOT IN ('resolved', 'cancelled')
GROUP BY category;

GRANT SELECT ON public.support_queue_open_counts_by_category TO authenticated;

-- =============================================================
-- 7) Trigger: staff response_required message => set WAITING + reset nudge flags
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_waiting_on_response_required()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_queue_item_id uuid;
  v_prev_status text;
BEGIN
  IF NOT NEW.response_required THEN
    RETURN NEW;
  END IF;

  SELECT (p.is_admin OR p.is_support OR p.is_moderator)
    INTO v_is_staff
  FROM public.profiles p
  WHERE p.id = NEW.sender_id;

  IF NOT COALESCE(v_is_staff, false) THEN
    RETURN NEW;
  END IF;

  SELECT sqi.id, sqi.status
    INTO v_queue_item_id, v_prev_status
  FROM public.support_queue_items sqi
  WHERE sqi.conversation_id = NEW.conversation_id
  LIMIT 1;

  IF v_queue_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_queue_items
  SET
    status = 'waiting',
    waiting_on_user_since = now(),
    last_response_required_sent_at = now(),
    nudge_48_sent_at = NULL,
    nudge_96_sent_at = NULL,
    updated_at = now()
  WHERE id = v_queue_item_id;

  INSERT INTO public.support_queue_item_events (
    queue_item_id, event_type, actor_id, previous_value, new_value, note
  ) VALUES (
    v_queue_item_id,
    'status_changed',
    NEW.sender_id,
    COALESCE(v_prev_status, 'unknown'),
    'waiting',
    'Response required sent - waiting timer started'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_waiting_on_response_required ON public.messages;
CREATE TRIGGER trg_set_waiting_on_response_required
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_waiting_on_response_required();

-- =============================================================
-- 8) Trigger: user reply while WAITING => move to IN_PROGRESS + clear waiting fields
-- =============================================================
CREATE OR REPLACE FUNCTION public.track_user_reply_to_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_queue_item_id uuid;
BEGIN
  SELECT (p.is_admin OR p.is_support OR p.is_moderator)
    INTO v_is_staff
  FROM public.profiles p
  WHERE p.id = NEW.sender_id;

  IF COALESCE(v_is_staff, false) THEN
    RETURN NEW;
  END IF;

  SELECT sqi.id
    INTO v_queue_item_id
  FROM public.support_queue_items sqi
  WHERE sqi.conversation_id = NEW.conversation_id
    AND sqi.status = 'waiting'
  LIMIT 1;

  IF v_queue_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_queue_items
  SET
    status = 'in_progress',
    last_user_message_at = now(),
    waiting_on_user_since = NULL,
    last_response_required_sent_at = NULL,
    nudge_48_sent_at = NULL,
    nudge_96_sent_at = NULL,
    updated_at = now()
  WHERE id = v_queue_item_id;

  INSERT INTO public.support_queue_item_events (
    queue_item_id, event_type, actor_id, previous_value, new_value, note
  ) VALUES (
    v_queue_item_id,
    'status_changed',
    NEW.sender_id,
    'waiting',
    'in_progress',
    'User replied - moved back to In Progress'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_user_reply_to_support ON public.messages;
CREATE TRIGGER trg_track_user_reply_to_support
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.track_user_reply_to_support();

-- =============================================================
-- 9) Scheduled automation function: 48hr nudge, 96hr final, 7-day cancel
--    IMPORTANT: does NOT change waiting_on_user_since (nudges do not reset timer)
-- =============================================================
CREATE OR REPLACE FUNCTION public.process_waiting_automation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nudge_48_count int := 0;
  v_nudge_96_count int := 0;
  v_cancel_count int := 0;
  v_item record;
BEGIN
  -- 48-HOUR NUDGE
  FOR v_item IN
    SELECT sqi.id, sqi.conversation_id, sqi.waiting_on_user_since
    FROM public.support_queue_items sqi
    WHERE sqi.status = 'waiting'
      AND sqi.waiting_on_user_since IS NOT NULL
      AND sqi.nudge_48_sent_at IS NULL
      AND now() >= sqi.waiting_on_user_since + interval '48 hours'
      AND now() <  sqi.waiting_on_user_since + interval '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = sqi.conversation_id
          AND m.created_at > sqi.waiting_on_user_since
          AND m.sender_id NOT IN (
            SELECT p.id
            FROM public.profiles p
            WHERE (p.is_admin OR p.is_support OR p.is_moderator)
          )
      )
  LOOP
    UPDATE public.support_queue_items
    SET nudge_48_sent_at = now(), updated_at = now()
    WHERE id = v_item.id;

    INSERT INTO public.support_queue_item_events (
      queue_item_id, event_type, previous_value, new_value, note
    ) VALUES (
      v_item.id,
      'nudge_48_sent',
      'waiting',
      'waiting',
      'SYS | 48hr nudge sent'
    );

    v_nudge_48_count := v_nudge_48_count + 1;
  END LOOP;

  -- 96-HOUR FINAL NUDGE (only if 48hr already sent)
  FOR v_item IN
    SELECT sqi.id, sqi.conversation_id, sqi.waiting_on_user_since
    FROM public.support_queue_items sqi
    WHERE sqi.status = 'waiting'
      AND sqi.waiting_on_user_since IS NOT NULL
      AND sqi.nudge_48_sent_at IS NOT NULL
      AND sqi.nudge_96_sent_at IS NULL
      AND now() >= sqi.waiting_on_user_since + interval '96 hours'
      AND now() <  sqi.waiting_on_user_since + interval '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = sqi.conversation_id
          AND m.created_at > sqi.waiting_on_user_since
          AND m.sender_id NOT IN (
            SELECT p.id
            FROM public.profiles p
            WHERE (p.is_admin OR p.is_support OR p.is_moderator)
          )
      )
  LOOP
    UPDATE public.support_queue_items
    SET nudge_96_sent_at = now(), updated_at = now()
    WHERE id = v_item.id;

    INSERT INTO public.support_queue_item_events (
      queue_item_id, event_type, previous_value, new_value, note
    ) VALUES (
      v_item.id,
      'nudge_96_sent',
      'waiting',
      'waiting',
      'SYS | 96hr final nudge sent (cancels day 7 if no reply)'
    );

    v_nudge_96_count := v_nudge_96_count + 1;
  END LOOP;

  -- 7-DAY AUTO-CANCEL
  FOR v_item IN
    SELECT sqi.id, sqi.conversation_id, sqi.waiting_on_user_since
    FROM public.support_queue_items sqi
    WHERE sqi.status = 'waiting'
      AND sqi.waiting_on_user_since IS NOT NULL
      AND now() >= sqi.waiting_on_user_since + interval '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = sqi.conversation_id
          AND m.created_at > sqi.waiting_on_user_since
          AND m.sender_id NOT IN (
            SELECT p.id
            FROM public.profiles p
            WHERE (p.is_admin OR p.is_support OR p.is_moderator)
          )
      )
  LOOP
    UPDATE public.support_queue_items
    SET
      status = 'cancelled',
      cancel_reason = 'No Response',
      resolved_at = now(),
      updated_at = now()
    WHERE id = v_item.id;

    INSERT INTO public.support_queue_item_events (
      queue_item_id, event_type, previous_value, new_value, note
    ) VALUES (
      v_item.id,
      'auto_cancelled',
      'waiting',
      'cancelled',
      'SYS | Auto-cancelled after 7 days with no response'
    );

    v_cancel_count := v_cancel_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'nudges_48hr_sent', v_nudge_48_count,
    'nudges_96hr_sent', v_nudge_96_count,
    'items_cancelled', v_cancel_count,
    'processed_at', now()
  );
END;
$$;

-- IMPORTANT: callable by edge function using service_role only
GRANT EXECUTE ON FUNCTION public.process_waiting_automation() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_waiting_automation() FROM authenticated;