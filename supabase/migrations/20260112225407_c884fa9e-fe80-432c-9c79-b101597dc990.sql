-- Prevent multiple pending Dual Role requests per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_dual_role_pending_per_user
ON public.dual_role_access_requests (user_id)
WHERE status = 'pending';