-- =====================================================
-- FIX: PUBLIC_USER_DATA on profiles (allowlist-based staff/admin)
-- =====================================================

-- 1) Create allowlist tables
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.staff_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('moderator','support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- 2) Seed allowlists BEFORE adding restrictive RLS policies
INSERT INTO public.admin_users (user_id, created_by)
SELECT id, id FROM public.profiles WHERE is_admin = true
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.staff_users (user_id, role, created_by)
SELECT id,
  CASE
    WHEN is_moderator = true THEN 'moderator'
    WHEN is_support = true THEN 'support'
  END,
  id
FROM public.profiles
WHERE (is_moderator = true OR is_support = true) AND is_admin = false
ON CONFLICT (user_id) DO NOTHING;

-- 3) RLS policies for allowlist tables (admins manage)
DROP POLICY IF EXISTS "admin_users_admin_manage" ON public.admin_users;
CREATE POLICY "admin_users_admin_manage"
ON public.admin_users
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_users_admin_manage" ON public.staff_users;
CREATE POLICY "staff_users_admin_manage"
ON public.staff_users
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- 4) Fix profiles SELECT policies: own + allowlist staff/admin
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff_allowlist" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_select_staff_allowlist"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff_users su WHERE su.user_id = auth.uid())
);

-- 5) Trigger to block self-escalation on sensitive columns
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if caller is in admin_users allowlist
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block changes to sensitive columns for non-admins
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
     OR NEW.is_support IS DISTINCT FROM OLD.is_support
     OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.is_vendor_admin IS DISTINCT FROM OLD.is_vendor_admin
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
  THEN
    RAISE EXCEPTION 'You cannot modify admin/staff/status fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profiles_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profiles_sensitive_columns();