-- Harden public.profiles table against public/unauthenticated access

-- 0) Ensure RLS is enabled (with IF EXISTS for safety)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) Force RLS even for table owner (with IF EXISTS for safety)
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

-- 2) Revoke all privileges from PUBLIC and anon roles
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 3) Explicit deny policies for anon (audit/scanner-friendly)
DROP POLICY IF EXISTS "Deny anon access" ON public.profiles;

CREATE POLICY "Deny anon access"
ON public.profiles
FOR SELECT
TO anon
USING (false);

DROP POLICY IF EXISTS "Deny anon writes" ON public.profiles;

CREATE POLICY "Deny anon writes"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);