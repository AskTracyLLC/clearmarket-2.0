-- STEP 1: Create sync functions (all SECURITY DEFINER, with FK-safe resolved_by)

-- Support Tickets sync
CREATE OR REPLACE FUNCTION public.sync_support_ticket_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_priority text;
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
BEGIN
  -- FK-safe: only use actor if profile exists
  SELECT p.id INTO v_actor_profile FROM public.profiles p WHERE p.id = v_actor;

  v_status := CASE
    WHEN NEW.status IN ('closed','resolved') THEN 'resolved'
    WHEN NEW.status = 'in_progress' THEN 'in_progress'
    WHEN NEW.status = 'waiting_on_user' THEN 'waiting'
    ELSE 'open'
  END;

  v_priority := CASE
    WHEN NEW.priority IN ('urgent','high') THEN 'urgent'
    ELSE 'normal'
  END;

  INSERT INTO public.support_queue_items (
    category, source_type, source_id,
    title, preview,
    priority, status,
    target_url, metadata,
    resolved_at, resolved_by
  ) VALUES (
    'support_tickets',
    'support_ticket',
    NEW.id,
    'Ticket: ' || COALESCE(NEW.subject,'No subject'),
    LEFT(COALESCE(NEW.subject,''), 200),
    v_priority,
    v_status,
    '/admin/support-queue?source_type=support_ticket&source_id=' || NEW.id::text,
    jsonb_build_object(
      'user_id', NEW.user_id,
      'category', NEW.category,
      'original_priority', NEW.priority
    ),
    CASE WHEN v_status='resolved' THEN COALESCE(NEW.closed_at, now()) ELSE NULL END,
    CASE WHEN v_status='resolved' THEN v_actor_profile ELSE NULL END
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    preview = EXCLUDED.preview,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    target_url = EXCLUDED.target_url,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    resolved_at = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_at, EXCLUDED.resolved_at, now())
      ELSE NULL
    END,
    resolved_by = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_by, EXCLUDED.resolved_by)
      ELSE NULL
    END;

  RETURN NEW;
END;
$$;

-- User Reports sync (uses correct column names: reporter_user_id, reported_user_id, reason_category, reason_details, reviewed_at, reviewed_by)
CREATE OR REPLACE FUNCTION public.sync_user_report_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reported_name text;
  v_title text;
  v_status text;
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
BEGIN
  -- FK-safe: only use actor if profile exists
  SELECT p.id INTO v_actor_profile FROM public.profiles p WHERE p.id = v_actor;

  SELECT full_name INTO v_reported_name
  FROM public.profiles
  WHERE id = NEW.reported_user_id;

  v_title := 'Report: ' || COALESCE(v_reported_name, 'Unknown User')
             || ' (' || COALESCE(NEW.reason_category, 'No reason') || ')';

  v_status := CASE
    WHEN NEW.status IN ('resolved','dismissed') THEN 'resolved'
    WHEN NEW.status = 'under_review' THEN 'in_progress'
    ELSE 'open'
  END;

  INSERT INTO public.support_queue_items (
    category, source_type, source_id,
    title, preview,
    priority, status,
    target_url, metadata,
    resolved_at, resolved_by
  ) VALUES (
    'user_reports',
    'user_report',
    NEW.id,
    v_title,
    LEFT(COALESCE(NEW.reason_details, ''), 200),
    'normal',
    v_status,
    '/admin/support-queue?source_type=user_report&source_id=' || NEW.id::text,
    jsonb_build_object(
      'reporter_user_id', NEW.reporter_user_id,
      'reported_user_id', NEW.reported_user_id,
      'reason_category', NEW.reason_category,
      'target_type', NEW.target_type
    ),
    CASE WHEN v_status='resolved' THEN COALESCE(NEW.reviewed_at, now()) ELSE NULL END,
    CASE WHEN v_status='resolved' THEN COALESCE(NEW.reviewed_by, v_actor_profile) ELSE NULL END
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    preview = EXCLUDED.preview,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    target_url = EXCLUDED.target_url,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    resolved_at = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_at, EXCLUDED.resolved_at, now())
      ELSE NULL
    END,
    resolved_by = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_by, EXCLUDED.resolved_by)
      ELSE NULL
    END;

  RETURN NEW;
END;
$$;

-- Connection Reviews sync (flagged reviews only, updates to resolved instead of delete)
CREATE OR REPLACE FUNCTION public.sync_review_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer_name text;
  v_subject_name text;
  v_title text;
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
BEGIN
  -- FK-safe: only use actor if profile exists
  SELECT p.id INTO v_actor_profile FROM public.profiles p WHERE p.id = v_actor;

  -- Only sync flagged reviews
  IF NEW.is_flagged = false THEN
    -- If unflagged, mark as resolved instead of deleting (preserves history)
    UPDATE public.support_queue_items
    SET status = 'resolved',
        resolved_at = COALESCE(resolved_at, now()),
        resolved_by = COALESCE(resolved_by, v_actor_profile),
        updated_at = now()
    WHERE source_type = 'review' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_reviewer_name FROM public.profiles WHERE id = NEW.reviewer_id;
  SELECT full_name INTO v_subject_name FROM public.profiles WHERE id = NEW.subject_id;

  v_title := 'Flagged Review: ' || COALESCE(v_reviewer_name, 'Unknown') || ' → ' || COALESCE(v_subject_name, 'Unknown');

  INSERT INTO public.support_queue_items (
    category, source_type, source_id,
    title, preview,
    priority, status,
    target_url, metadata,
    resolved_at, resolved_by
  ) VALUES (
    'reviews',
    'review',
    NEW.id,
    v_title,
    LEFT(COALESCE(NEW.summary_comment, NEW.notes, ''), 200),
    'normal',
    'open',
    '/admin/support-queue?source_type=review&source_id=' || NEW.id::text,
    jsonb_build_object(
      'reviewer_id', NEW.reviewer_id,
      'subject_id', NEW.subject_id,
      'reviewer_role', NEW.reviewer_role
    ),
    NULL,
    NULL
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    preview = EXCLUDED.preview,
    status = 'open',
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    resolved_at = NULL,
    resolved_by = NULL;

  RETURN NEW;
END;
$$;

-- Background Checks sync
CREATE OR REPLACE FUNCTION public.sync_background_check_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep_name text;
  v_title text;
  v_status text;
  v_priority text;
BEGIN
  SELECT full_name INTO v_rep_name FROM public.profiles WHERE id = NEW.field_rep_id;

  v_title := 'Background Check: ' || COALESCE(v_rep_name, 'Unknown Rep');

  v_status := CASE
    WHEN NEW.status IN ('approved','rejected','expired') THEN 'resolved'
    WHEN NEW.status = 'in_review' THEN 'in_progress'
    ELSE 'open'
  END;

  v_priority := CASE
    WHEN NEW.status = 'pending' THEN 'urgent'
    ELSE 'normal'
  END;

  INSERT INTO public.support_queue_items (
    category, source_type, source_id,
    title, preview,
    priority, status,
    target_url, metadata,
    resolved_at, resolved_by
  ) VALUES (
    'background_checks',
    'background_check',
    NEW.id,
    v_title,
    'Provider: ' || COALESCE(NEW.provider, 'Unknown') || ' | Status: ' || NEW.status,
    v_priority,
    v_status,
    '/admin/support-queue?source_type=background_check&source_id=' || NEW.id::text,
    jsonb_build_object(
      'field_rep_id', NEW.field_rep_id,
      'provider', NEW.provider,
      'check_id', NEW.check_id
    ),
    CASE WHEN v_status='resolved' THEN COALESCE(NEW.reviewed_at, now()) ELSE NULL END,
    CASE WHEN v_status='resolved' THEN NEW.reviewed_by_user_id ELSE NULL END
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    preview = EXCLUDED.preview,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    target_url = EXCLUDED.target_url,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    resolved_at = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_at, EXCLUDED.resolved_at, now())
      ELSE NULL
    END,
    resolved_by = CASE
      WHEN EXCLUDED.status='resolved' THEN COALESCE(support_queue_items.resolved_by, EXCLUDED.resolved_by)
      ELSE NULL
    END;

  RETURN NEW;
END;
$$;

-- STEP 2: Create backfill function
CREATE OR REPLACE FUNCTION public.backfill_support_queue_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  r RECORD;
  cr RECORD;
  bc RECORD;
  v_reported_name text;
  v_reviewer_name text;
  v_subject_name text;
  v_rep_name text;
BEGIN
  -- Backfill support_tickets
  FOR t IN SELECT * FROM public.support_tickets LOOP
    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      created_at, resolved_at, resolved_by
    ) VALUES (
      'support_tickets',
      'support_ticket',
      t.id,
      'Ticket: ' || COALESCE(t.subject,'No subject'),
      LEFT(COALESCE(t.subject,''), 200),
      CASE WHEN t.priority IN ('urgent','high') THEN 'urgent' ELSE 'normal' END,
      CASE
        WHEN t.status IN ('closed','resolved') THEN 'resolved'
        WHEN t.status = 'in_progress' THEN 'in_progress'
        WHEN t.status = 'waiting_on_user' THEN 'waiting'
        ELSE 'open'
      END,
      '/admin/support-queue?source_type=support_ticket&source_id=' || t.id::text,
      jsonb_build_object('user_id', t.user_id, 'category', t.category, 'original_priority', t.priority),
      t.created_at,
      CASE WHEN t.status IN ('closed','resolved') THEN t.closed_at ELSE NULL END,
      NULL
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END LOOP;

  -- Backfill user_reports (uses correct columns: reviewed_at, reviewed_by)
  FOR r IN SELECT * FROM public.user_reports LOOP
    SELECT full_name INTO v_reported_name FROM public.profiles WHERE id = r.reported_user_id;

    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      created_at, resolved_at, resolved_by
    ) VALUES (
      'user_reports',
      'user_report',
      r.id,
      'Report: ' || COALESCE(v_reported_name, 'Unknown User') || ' (' || COALESCE(r.reason_category, 'No reason') || ')',
      LEFT(COALESCE(r.reason_details, ''), 200),
      'normal',
      CASE
        WHEN r.status IN ('resolved','dismissed') THEN 'resolved'
        WHEN r.status = 'under_review' THEN 'in_progress'
        ELSE 'open'
      END,
      '/admin/support-queue?source_type=user_report&source_id=' || r.id::text,
      jsonb_build_object('reporter_user_id', r.reporter_user_id, 'reported_user_id', r.reported_user_id, 'reason_category', r.reason_category, 'target_type', r.target_type),
      r.created_at,
      CASE WHEN r.status IN ('resolved','dismissed') THEN r.reviewed_at ELSE NULL END,
      r.reviewed_by
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END LOOP;

  -- Backfill connection_reviews (only flagged ones)
  FOR cr IN SELECT * FROM public.connection_reviews WHERE is_flagged = true LOOP
    SELECT full_name INTO v_reviewer_name FROM public.profiles WHERE id = cr.reviewer_id;
    SELECT full_name INTO v_subject_name FROM public.profiles WHERE id = cr.subject_id;

    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      created_at, resolved_at, resolved_by
    ) VALUES (
      'reviews',
      'review',
      cr.id,
      'Flagged Review: ' || COALESCE(v_reviewer_name, 'Unknown') || ' → ' || COALESCE(v_subject_name, 'Unknown'),
      LEFT(COALESCE(cr.summary_comment, cr.notes, ''), 200),
      'normal',
      'open',
      '/admin/support-queue?source_type=review&source_id=' || cr.id::text,
      jsonb_build_object('reviewer_id', cr.reviewer_id, 'subject_id', cr.subject_id, 'reviewer_role', cr.reviewer_role),
      cr.created_at,
      NULL,
      NULL
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END LOOP;

  -- Backfill background_checks
  FOR bc IN SELECT * FROM public.background_checks LOOP
    SELECT full_name INTO v_rep_name FROM public.profiles WHERE id = bc.field_rep_id;

    INSERT INTO public.support_queue_items (
      category, source_type, source_id,
      title, preview,
      priority, status,
      target_url, metadata,
      created_at, resolved_at, resolved_by
    ) VALUES (
      'background_checks',
      'background_check',
      bc.id,
      'Background Check: ' || COALESCE(v_rep_name, 'Unknown Rep'),
      'Provider: ' || COALESCE(bc.provider, 'Unknown') || ' | Status: ' || bc.status,
      CASE WHEN bc.status = 'pending' THEN 'urgent' ELSE 'normal' END,
      CASE
        WHEN bc.status IN ('approved','rejected','expired') THEN 'resolved'
        WHEN bc.status = 'in_review' THEN 'in_progress'
        ELSE 'open'
      END,
      '/admin/support-queue?source_type=background_check&source_id=' || bc.id::text,
      jsonb_build_object('field_rep_id', bc.field_rep_id, 'provider', bc.provider, 'check_id', bc.check_id),
      bc.created_at,
      CASE WHEN bc.status IN ('approved','rejected','expired') THEN bc.reviewed_at ELSE NULL END,
      bc.reviewed_by_user_id
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END LOOP;
END;
$$;

-- STEP 3: Safer RLS policies (includes both postgres and supabase_admin roles)
DROP POLICY IF EXISTS "System can insert support queue items" ON public.support_queue_items;
CREATE POLICY "System can insert support queue items"
  ON public.support_queue_items
  FOR INSERT
  WITH CHECK (current_user IN ('postgres', 'supabase_admin'));

DROP POLICY IF EXISTS "System can update support queue items" ON public.support_queue_items;
CREATE POLICY "System can update support queue items"
  ON public.support_queue_items
  FOR UPDATE
  USING (current_user IN ('postgres', 'supabase_admin'))
  WITH CHECK (current_user IN ('postgres', 'supabase_admin'));

-- STEP 4: Create triggers on source tables
DROP TRIGGER IF EXISTS sync_support_ticket_to_queue_trigger ON public.support_tickets;
CREATE TRIGGER sync_support_ticket_to_queue_trigger
  AFTER INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_support_ticket_to_queue();

DROP TRIGGER IF EXISTS sync_user_report_to_queue_trigger ON public.user_reports;
CREATE TRIGGER sync_user_report_to_queue_trigger
  AFTER INSERT OR UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_report_to_queue();

DROP TRIGGER IF EXISTS sync_review_to_queue_trigger ON public.connection_reviews;
CREATE TRIGGER sync_review_to_queue_trigger
  AFTER INSERT OR UPDATE ON public.connection_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_to_queue();

DROP TRIGGER IF EXISTS sync_background_check_to_queue_trigger ON public.background_checks;
CREATE TRIGGER sync_background_check_to_queue_trigger
  AFTER INSERT OR UPDATE ON public.background_checks
  FOR EACH ROW EXECUTE FUNCTION public.sync_background_check_to_queue();

-- STEP 5: Run the backfill
SELECT public.backfill_support_queue_items();