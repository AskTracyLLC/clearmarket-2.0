-- Admin Users list RPC (safe columns, RLS bypass, admin-gated)
-- Idempotent

-- Drop first for idempotency
DROP FUNCTION IF EXISTS public.admin_list_users_safe(integer);

CREATE FUNCTION public.admin_list_users_safe(p_limit integer DEFAULT 500)
RETURNS TABLE (
  id uuid,
  full_name text,
  is_fieldrep boolean,
  is_vendor_admin boolean,
  is_vendor_staff boolean,
  is_admin boolean,
  is_moderator boolean,
  is_support boolean,
  is_super_admin boolean,
  account_status text,
  deactivated_at timestamptz,
  deactivated_reason text,
  community_score integer,
  last_seen_at timestamptz,
  staff_anonymous_id text,
  anonymous_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.is_fieldrep, false)      AS is_fieldrep,
    COALESCE(p.is_vendor_admin, false)  AS is_vendor_admin,
    COALESCE(p.is_vendor_staff, false)  AS is_vendor_staff,
    COALESCE(p.is_admin, false)         AS is_admin,
    COALESCE(p.is_moderator, false)     AS is_moderator,
    COALESCE(p.is_support, false)       AS is_support,
    COALESCE(p.is_super_admin, false)   AS is_super_admin,
    COALESCE(p.account_status, 'active') AS account_status,
    p.deactivated_at,
    p.deactivated_reason,
    COALESCE(p.community_score, 0)      AS community_score,
    p.last_seen_at,
    p.staff_anonymous_id,
    p.anonymous_id,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND (COALESCE(me.is_admin,false) OR COALESCE(me.is_super_admin,false))
  )
  ORDER BY p.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 500), 1000);
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.admin_list_users_safe(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users_safe(integer) TO authenticated;