-- Fix security definer view: connected_rep_display_info
-- Set security_invoker = true so RLS is evaluated as the querying user

ALTER VIEW public.connected_rep_display_info SET (security_invoker = true);