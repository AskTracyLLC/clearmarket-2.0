-- ===================
-- VENDOR ACTIVITY EVENTS TABLE
-- ===================
CREATE TABLE IF NOT EXISTS public.vendor_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_owner_user_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent FK constraints
ALTER TABLE public.vendor_activity_events
  DROP CONSTRAINT IF EXISTS vendor_activity_events_vendor_owner_fkey;

ALTER TABLE public.vendor_activity_events
  DROP CONSTRAINT IF EXISTS vendor_activity_events_actor_fkey;

ALTER TABLE public.vendor_activity_events
  ADD CONSTRAINT vendor_activity_events_vendor_owner_fkey
  FOREIGN KEY (vendor_owner_user_id) REFERENCES public.profiles(id);

ALTER TABLE public.vendor_activity_events
  ADD CONSTRAINT vendor_activity_events_actor_fkey
  FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_activity_events_owner_created
  ON public.vendor_activity_events (vendor_owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_activity_events_actor_created
  ON public.vendor_activity_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_activity_events_action_created
  ON public.vendor_activity_events (action, created_at DESC);

-- ===================
-- RLS
-- ===================
ALTER TABLE public.vendor_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform staff can view all vendor activity" ON public.vendor_activity_events;
CREATE POLICY "Platform staff can view all vendor activity"
  ON public.vendor_activity_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_moderator = true OR p.is_support = true)
    )
  );

DROP POLICY IF EXISTS "Vendor owners can view their activity" ON public.vendor_activity_events;
CREATE POLICY "Vendor owners can view their activity"
  ON public.vendor_activity_events
  FOR SELECT
  TO authenticated
  USING (vendor_owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Vendor users can log their own actions" ON public.vendor_activity_events;
CREATE POLICY "Vendor users can log their own actions"
  ON public.vendor_activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.has_vendor_access_by_owner(vendor_owner_user_id)
  );

-- ===================
-- LOGGING FUNCTION (with RLS bypass for trusted server-side logging)
-- ===================
CREATE OR REPLACE FUNCTION public.log_vendor_activity(
  p_vendor_owner_user_id uuid,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.vendor_activity_events (
    vendor_owner_user_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    p_vendor_owner_user_id,
    COALESCE(auth.uid(), p_vendor_owner_user_id),
    p_action,
    p_target_type,
    p_target_id,
    p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_vendor_activity(uuid, text, text, uuid, jsonb) TO authenticated;

-- ===================
-- ADAPTER FUNCTION (bridges existing log_vendor_staff_action calls)
-- ===================
CREATE OR REPLACE FUNCTION public.log_vendor_staff_action(
  p_vendor_profile_id uuid,
  p_action_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner_user_id uuid;
  v_actor_user_id uuid;
  v_target_id uuid;
BEGIN
  -- Get the vendor owner user_id from vendor_profile
  SELECT user_id INTO v_owner_user_id
  FROM public.vendor_profile
  WHERE id = p_vendor_profile_id;

  IF v_owner_user_id IS NULL THEN
    RAISE WARNING 'log_vendor_staff_action: vendor_profile_id % not found', p_vendor_profile_id;
    RETURN;
  END IF;

  -- Actor: prefer auth.uid(), fallback to owner (for service_role calls)
  v_actor_user_id := COALESCE(auth.uid(), v_owner_user_id);

  -- Extract target_id if present
  v_target_id := (p_details->>'target_id')::uuid;

  INSERT INTO public.vendor_activity_events (
    vendor_owner_user_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    v_owner_user_id,
    v_actor_user_id,
    p_action_type,
    p_details->>'target_type',
    v_target_id,
    p_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_vendor_staff_action(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_vendor_staff_action(uuid, text, jsonb) TO service_role;