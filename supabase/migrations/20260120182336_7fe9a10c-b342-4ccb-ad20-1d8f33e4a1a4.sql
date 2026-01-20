BEGIN;

-- Fix search_path for the two new SECURITY DEFINER functions
ALTER FUNCTION public.sync_rep_profile_anon_id() SET search_path = public;
ALTER FUNCTION public.enforce_rep_profile_anon_id_from_profiles() SET search_path = public;

COMMIT;