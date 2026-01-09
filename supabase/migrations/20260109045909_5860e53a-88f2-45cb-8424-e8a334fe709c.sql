-- Drop vendor SELECT policies - vendors must use the safe view + contact unlock table
DROP POLICY IF EXISTS "rep_profile_select_connected_vendor" ON public.rep_profile;
DROP POLICY IF EXISTS "rep_profile_select_unlocked_vendor" ON public.rep_profile;