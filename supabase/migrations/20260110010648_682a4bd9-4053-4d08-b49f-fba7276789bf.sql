-- ============================================================
-- 1) support_queue_items (Unified Inbox Source of Truth)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'reviews', 'moderation', 'background_checks', 'user_reports', 'billing', 'support_tickets', 'other'
  )),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  title TEXT NOT NULL,
  preview TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT unique_source UNIQUE (source_type, source_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_queue_status ON public.support_queue_items(status);
CREATE INDEX IF NOT EXISTS idx_support_queue_category ON public.support_queue_items(category);
CREATE INDEX IF NOT EXISTS idx_support_queue_assigned_to ON public.support_queue_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_queue_created_at ON public.support_queue_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_queue_priority ON public.support_queue_items(priority);
CREATE INDEX IF NOT EXISTS idx_support_queue_category_status ON public.support_queue_items(category, status);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_support_queue_items_updated_at ON public.support_queue_items;
CREATE TRIGGER set_support_queue_items_updated_at
  BEFORE UPDATE ON public.support_queue_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 2) support_queue_item_events (Audit Log)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_queue_item_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID NOT NULL REFERENCES public.support_queue_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'assigned', 'status_changed', 'priority_changed', 'note_added', 'resolved'
  )),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_events_item ON public.support_queue_item_events(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_created_at ON public.support_queue_item_events(created_at DESC);


-- ============================================================
-- 3) Auto-log changes into support_queue_item_events (WITH SAFETY PATCH)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_support_queue_item_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_profile uuid;
BEGIN
  -- Safety patch: only log actor_id if profile exists, otherwise NULL
  SELECT p.id INTO v_actor_profile
  FROM public.profiles p
  WHERE p.id = v_actor;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_queue_item_events(queue_item_id, event_type, actor_id, note)
    VALUES (NEW.id, 'created', v_actor_profile, 'Queue item created');
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.assigned_to::text,'') <> COALESCE(NEW.assigned_to::text,'') THEN
    INSERT INTO public.support_queue_item_events(queue_item_id, event_type, actor_id, previous_value, new_value)
    VALUES (NEW.id, 'assigned', v_actor_profile, OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;

  IF OLD.status <> NEW.status THEN
    INSERT INTO public.support_queue_item_events(queue_item_id, event_type, actor_id, previous_value, new_value)
    VALUES (NEW.id, 'status_changed', v_actor_profile, OLD.status, NEW.status);
  END IF;

  IF OLD.priority <> NEW.priority THEN
    INSERT INTO public.support_queue_item_events(queue_item_id, event_type, actor_id, previous_value, new_value)
    VALUES (NEW.id, 'priority_changed', v_actor_profile, OLD.priority, NEW.priority);
  END IF;

  IF OLD.status <> 'resolved' AND NEW.status = 'resolved' THEN
    INSERT INTO public.support_queue_item_events(queue_item_id, event_type, actor_id, note)
    VALUES (NEW.id, 'resolved', v_actor_profile, 'Queue item resolved');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_support_queue_item_events ON public.support_queue_items;
CREATE TRIGGER trg_log_support_queue_item_events
AFTER INSERT OR UPDATE ON public.support_queue_items
FOR EACH ROW
EXECUTE FUNCTION public.log_support_queue_item_events();


-- ============================================================
-- 4) Views for Gmail-style category counts
-- ============================================================

CREATE OR REPLACE VIEW public.support_queue_counts_by_category_status AS
SELECT category, status, COUNT(*)::int AS item_count
FROM public.support_queue_items
GROUP BY category, status;

CREATE OR REPLACE VIEW public.support_queue_open_counts_by_category AS
SELECT category, COUNT(*)::int AS open_count
FROM public.support_queue_items
WHERE status IN ('open', 'in_progress', 'waiting')
GROUP BY category;

GRANT SELECT ON public.support_queue_counts_by_category_status TO authenticated;
GRANT SELECT ON public.support_queue_open_counts_by_category TO authenticated;


-- ============================================================
-- 5) RLS (staff-only access)
-- ============================================================

ALTER TABLE public.support_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_queue_item_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view support queue items" ON public.support_queue_items;
CREATE POLICY "Staff can view support queue items"
  ON public.support_queue_items
  FOR SELECT
  USING (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert support queue items" ON public.support_queue_items;
CREATE POLICY "Staff can insert support queue items"
  ON public.support_queue_items
  FOR INSERT
  WITH CHECK (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Staff can update support queue items" ON public.support_queue_items;
CREATE POLICY "Staff can update support queue items"
  ON public.support_queue_items
  FOR UPDATE
  USING (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Staff can view queue events" ON public.support_queue_item_events;
CREATE POLICY "Staff can view queue events"
  ON public.support_queue_item_events
  FOR SELECT
  USING (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert queue events" ON public.support_queue_item_events;
CREATE POLICY "Staff can insert queue events"
  ON public.support_queue_item_events
  FOR INSERT
  WITH CHECK (public.is_staff_user(auth.uid()));