-- =============================================
-- 1) role_switch_audit table with CHECK constraint
-- =============================================
CREATE TABLE public.role_switch_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_role text,
  to_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce valid role values
ALTER TABLE public.role_switch_audit
  ADD CONSTRAINT role_switch_audit_roles_check
  CHECK (
    (from_role IS NULL OR from_role IN ('rep','vendor'))
    AND to_role IN ('rep','vendor')
  );

ALTER TABLE public.role_switch_audit ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit entries
CREATE POLICY "Admins can view role switch audit"
  ON public.role_switch_audit FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- Users can insert their own audit entries (server-side preferred, but acceptable for now)
CREATE POLICY "Users can insert own role switch audit"
  ON public.role_switch_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_role_switch_audit_user_id ON public.role_switch_audit(user_id);
CREATE INDEX idx_role_switch_audit_created_at ON public.role_switch_audit(created_at DESC);

-- =============================================
-- 2) mimic_audit table with restricted UPDATE
-- =============================================
CREATE TABLE public.mimic_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- Enforce ended_at >= started_at
ALTER TABLE public.mimic_audit
  ADD CONSTRAINT mimic_ended_after_started
  CHECK (ended_at IS NULL OR ended_at >= started_at);

ALTER TABLE public.mimic_audit ENABLE ROW LEVEL SECURITY;

-- Admins can read all mimic audit entries
CREATE POLICY "Admins can view mimic audit"
  ON public.mimic_audit FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- Admins can insert mimic audit entries
CREATE POLICY "Admins can insert mimic audit"
  ON public.mimic_audit FOR INSERT
  WITH CHECK (public.is_admin_user(auth.uid()) AND auth.uid() = admin_id);

-- Admins can update only their own sessions (column restriction via trigger below)
CREATE POLICY "Admins can update own mimic audit"
  ON public.mimic_audit FOR UPDATE
  USING (public.is_admin_user(auth.uid()) AND auth.uid() = admin_id);

-- Trigger to prevent modifying immutable columns on mimic_audit
CREATE OR REPLACE FUNCTION public.protect_mimic_audit_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing immutable columns
  IF OLD.admin_id IS DISTINCT FROM NEW.admin_id THEN
    RAISE EXCEPTION 'Cannot modify admin_id after insert';
  END IF;
  IF OLD.target_user_id IS DISTINCT FROM NEW.target_user_id THEN
    RAISE EXCEPTION 'Cannot modify target_user_id after insert';
  END IF;
  IF OLD.started_at IS DISTINCT FROM NEW.started_at THEN
    RAISE EXCEPTION 'Cannot modify started_at after insert';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_mimic_audit_immutable
  BEFORE UPDATE ON public.mimic_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_mimic_audit_immutable_columns();

CREATE INDEX idx_mimic_audit_admin_id ON public.mimic_audit(admin_id);
CREATE INDEX idx_mimic_audit_target_user_id ON public.mimic_audit(target_user_id);
CREATE INDEX idx_mimic_audit_started_at ON public.mimic_audit(started_at DESC);

-- =============================================
-- 3) Add role_filter column to notifications
-- =============================================
ALTER TABLE public.notifications
  ADD COLUMN role_filter text NOT NULL DEFAULT 'both'
  CONSTRAINT notifications_role_filter_check CHECK (role_filter IN ('rep', 'vendor', 'both'));

-- Performance index for filtering
CREATE INDEX idx_notifications_role_filter ON public.notifications(role_filter);