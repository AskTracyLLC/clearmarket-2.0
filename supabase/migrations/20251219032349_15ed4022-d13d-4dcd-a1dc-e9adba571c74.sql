-- 0) Email opt-in setting for admin updates
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_opt_in_admin_updates boolean NOT NULL DEFAULT true;

-- 1) Broadcast master table
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','archived')),
  send_at timestamptz,
  sent_at timestamptz,

  title text NOT NULL,
  email_subject text,
  message_md text NOT NULL,
  cta_label text NOT NULL DEFAULT 'Give Feedback',

  -- example: {"roles":["field_rep","vendor"],"active_days":30}
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- stats updated server-side after send
  stats jsonb NOT NULL DEFAULT '{"sent":0,"responses":0,"avg_rating":null}'::jsonb
);

-- 2) Recipient table
CREATE TABLE IF NOT EXISTS public.admin_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz,
  email_provider_id text,
  email_error text,
  notification_id uuid REFERENCES public.notifications(id),
  opened_at timestamptz,
  responded_at timestamptz,

  UNIQUE (broadcast_id, user_id)
);

-- 3) Feedback response (one per recipient)
CREATE TABLE IF NOT EXISTS public.admin_broadcast_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.admin_broadcast_recipients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  like_text text,
  dislike_text text,
  suggestion_text text,

  allow_spotlight boolean NOT NULL DEFAULT false,
  allow_name boolean NOT NULL DEFAULT false,

  UNIQUE (recipient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_status ON public.admin_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_broadcast ON public.admin_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_user ON public.admin_broadcast_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_feedback_recipient ON public.admin_broadcast_feedback(recipient_id);

-- RLS
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_broadcast_feedback ENABLE ROW LEVEL SECURITY;

-- Broadcasts: admin only (using existing is_admin_user function)
CREATE POLICY admins_manage_broadcasts
ON public.admin_broadcasts
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Recipients: admin can manage; user can select their own
CREATE POLICY recipients_select_admin_or_owner
ON public.admin_broadcast_recipients
FOR SELECT
USING (is_admin_user(auth.uid()) OR user_id = auth.uid());

CREATE POLICY recipients_insert_admin_only
ON public.admin_broadcast_recipients
FOR INSERT
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY recipients_update_admin_only
ON public.admin_broadcast_recipients
FOR UPDATE
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Feedback: admin can view all; users can insert/update their own
CREATE POLICY feedback_select_admin_or_owner
ON public.admin_broadcast_feedback
FOR SELECT
USING (is_admin_user(auth.uid()) OR user_id = auth.uid());

CREATE POLICY feedback_insert_owner_only
ON public.admin_broadcast_feedback
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY feedback_update_owner_only
ON public.admin_broadcast_feedback
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RPC: Send admin broadcast
CREATE OR REPLACE FUNCTION public.send_admin_broadcast(p_broadcast_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
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
    -- Insert recipient (skip if already exists)
    INSERT INTO public.admin_broadcast_recipients (broadcast_id, user_id)
    VALUES (p_broadcast_id, v_user.id)
    ON CONFLICT (broadcast_id, user_id) DO NOTHING
    RETURNING id INTO v_recipient_id;

    IF v_recipient_id IS NOT NULL THEN
      v_recipient_count := v_recipient_count + 1;

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

      -- Link notification to recipient
      UPDATE public.admin_broadcast_recipients
      SET notification_id = v_notification_id
      WHERE id = v_recipient_id;

      v_notification_count := v_notification_count + 1;
    END IF;
  END LOOP;

  -- Update broadcast status and stats
  UPDATE public.admin_broadcasts
  SET 
    status = 'sent',
    sent_at = now(),
    updated_at = now(),
    stats = jsonb_build_object(
      'sent', v_recipient_count,
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
$$;

-- RPC: Update broadcast stats (to be called periodically or after feedback submission)
CREATE OR REPLACE FUNCTION public.update_broadcast_stats(p_broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_sent int;
  v_responses int;
  v_avg_rating numeric;
BEGIN
  SELECT COUNT(*) INTO v_sent
  FROM public.admin_broadcast_recipients
  WHERE broadcast_id = p_broadcast_id;

  SELECT COUNT(*), AVG(rating)::numeric(3,2)
  INTO v_responses, v_avg_rating
  FROM public.admin_broadcast_feedback f
  JOIN public.admin_broadcast_recipients r ON f.recipient_id = r.id
  WHERE r.broadcast_id = p_broadcast_id;

  UPDATE public.admin_broadcasts
  SET stats = jsonb_build_object(
    'sent', v_sent,
    'responses', v_responses,
    'avg_rating', v_avg_rating
  ),
  updated_at = now()
  WHERE id = p_broadcast_id;
END;
$$;

-- Trigger to update stats when feedback is inserted/updated
CREATE OR REPLACE FUNCTION public.trigger_update_broadcast_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_broadcast_id uuid;
BEGIN
  -- Get broadcast_id from recipient
  SELECT broadcast_id INTO v_broadcast_id
  FROM public.admin_broadcast_recipients
  WHERE id = COALESCE(NEW.recipient_id, OLD.recipient_id);

  IF v_broadcast_id IS NOT NULL THEN
    PERFORM public.update_broadcast_stats(v_broadcast_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_broadcast_stats_on_feedback
AFTER INSERT OR UPDATE OR DELETE ON public.admin_broadcast_feedback
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_broadcast_stats();

-- Trigger to mark recipient as responded when feedback is submitted
CREATE OR REPLACE FUNCTION public.trigger_mark_recipient_responded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.admin_broadcast_recipients
  SET responded_at = now()
  WHERE id = NEW.recipient_id
    AND responded_at IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_recipient_responded_on_feedback
AFTER INSERT ON public.admin_broadcast_feedback
FOR EACH ROW
EXECUTE FUNCTION public.trigger_mark_recipient_responded();