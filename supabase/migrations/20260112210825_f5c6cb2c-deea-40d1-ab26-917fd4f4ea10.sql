-- Add requested_code column for Dual Role Requests
ALTER TABLE public.dual_role_access_requests 
ADD COLUMN IF NOT EXISTS requested_code text;

-- Add a comment for clarity
COMMENT ON COLUMN public.dual_role_access_requests.requested_code IS 'Optional vendor code requested by the user during Dual Role request submission';