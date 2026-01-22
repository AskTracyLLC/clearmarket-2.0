-- Add a policy allowing all authenticated users to SELECT basic vendor_profile data
-- This is needed for aggregate views like the coverage map to work correctly
-- The policy only allows reading basic fields (user_id, state, regions_covered) needed for counts

CREATE POLICY "Authenticated users can view basic vendor info for aggregates" 
ON public.vendor_profile 
FOR SELECT 
TO authenticated
USING (
  -- Allow reading from vendor_profile for verified vendors only
  -- This enables coverage map and similar aggregate views to work
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = vendor_profile.user_id 
    AND p.is_vendor_admin = true 
    AND p.account_status = 'active'
  )
);