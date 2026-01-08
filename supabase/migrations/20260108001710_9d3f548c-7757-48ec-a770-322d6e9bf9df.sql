-- 1) Composite index for role_switch_audit (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_role_switch_audit_user_created
ON public.role_switch_audit (user_id, created_at DESC);

-- 2) Trigger function ownership hygiene
ALTER FUNCTION public.protect_mimic_audit_immutable_columns() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_mimic_audit_immutable_columns() FROM PUBLIC;