BEGIN;

-- 1) Create profiles_private table
CREATE TABLE IF NOT EXISTS public.profiles_private (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- 3) RLS: Users can only SELECT their own email
DROP POLICY IF EXISTS "Users can read own email" ON public.profiles_private;
CREATE POLICY "Users can read own email"
  ON public.profiles_private
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 4) Explicitly block all client writes
DROP POLICY IF EXISTS "Deny client inserts" ON public.profiles_private;
CREATE POLICY "Deny client inserts"
  ON public.profiles_private
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client updates" ON public.profiles_private;
CREATE POLICY "Deny client updates"
  ON public.profiles_private
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client deletes" ON public.profiles_private;
CREATE POLICY "Deny client deletes"
  ON public.profiles_private
  FOR DELETE
  TO authenticated
  USING (false);

-- 5) Backfill emails from profiles.email (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
  ) THEN
    INSERT INTO public.profiles_private (profile_id, email)
    SELECT id, email
    FROM public.profiles
    WHERE email IS NOT NULL AND btrim(email) <> ''
    ON CONFLICT (profile_id) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = now();
  END IF;
END $$;

-- 6) Create admin email access audit log
CREATE TABLE IF NOT EXISTS public.admin_email_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_email_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view email access log" ON public.admin_email_access_log;
CREATE POLICY "Only admins can view email access log"
  ON public.admin_email_access_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Explicitly deny direct inserts/updates/deletes from client
DROP POLICY IF EXISTS "Deny log inserts" ON public.admin_email_access_log;
CREATE POLICY "Deny log inserts"
  ON public.admin_email_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny log updates" ON public.admin_email_access_log;
CREATE POLICY "Deny log updates"
  ON public.admin_email_access_log
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny log deletes" ON public.admin_email_access_log;
CREATE POLICY "Deny log deletes"
  ON public.admin_email_access_log
  FOR DELETE
  TO authenticated
  USING (false);

-- 7) Admin RPC (controlled + audited)
CREATE OR REPLACE FUNCTION public.admin_get_profile_email(
  p_target_profile_id uuid,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Reason must be at least 10 characters';
  END IF;

  INSERT INTO public.admin_email_access_log (admin_id, target_profile_id, reason)
  VALUES (auth.uid(), p_target_profile_id, btrim(p_reason));

  SELECT email INTO v_email
  FROM public.profiles_private
  WHERE profile_id = p_target_profile_id;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_profile_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_email(uuid, text) TO authenticated;

-- 8) profiles_safe view (minimal & stable)
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  full_name,
  is_fieldrep,
  is_vendor_admin,
  is_vendor_staff,
  is_admin,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

-- 9) Update handle_new_user() to split data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles_private (profile_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (profile_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (default Supabase name)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10) Unique index on email (only if no duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles_private
    GROUP BY lower(email)
    HAVING count(*) > 1
    LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_private_email_unique
      ON public.profiles_private (lower(email));
  END IF;
END $$;

-- 11) Drop email column from profiles (after backfill)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

COMMIT;