
-- Cleanup: Remove redundant/legacy SELECT policies on vendor_profile
-- Keep only the explicit owner + staff policies we created

DROP POLICY IF EXISTS "Vendor profiles are viewable by authenticated users" ON public.vendor_profile;
DROP POLICY IF EXISTS "Staff can view all vendor profiles" ON public.vendor_profile;
