BEGIN;

-- 1) Remove unlock-based vendor access to full contact info
DROP POLICY IF EXISTS "rep_contact_select_vendor_connected_or_unlocked"
ON public.rep_contact_info;

-- 2) Replace with connected-only vendor access (self/admin handled by existing policies)
CREATE POLICY "rep_contact_select_vendor_connected_only"
ON public.rep_contact_info
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_vendor_admin = true
      AND p.account_status = 'active'
  )
  AND EXISTS (
    SELECT 1
    FROM public.vendor_connections vc
    WHERE vc.vendor_id = auth.uid()
      AND vc.field_rep_id = rep_contact_info.rep_user_id
      AND vc.status = 'connected'::public.vendor_connection_status
  )
);

-- 3) Deprecate unlock function (prevents any leftover code path from working)
CREATE OR REPLACE FUNCTION public.unlock_rep_contact(p_vendor_user_id uuid, p_rep_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Contact unlock feature has been removed. Vendors must connect with reps to access contact details.';
END;
$$;

COMMENT ON FUNCTION public.unlock_rep_contact(uuid, uuid) IS
'DEPRECATED: Contact unlock feature has been removed. This stub prevents accidental use.';

-- 4) Revoke/grant for consistent permissions (function now always errors anyway)
REVOKE EXECUTE ON FUNCTION public.unlock_rep_contact(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unlock_rep_contact(uuid, uuid) TO authenticated;

-- 5) Keep unlock table for audit history but mark deprecated
COMMENT ON TABLE public.rep_contact_unlocks IS
'DEPRECATED: Historical audit table only. No longer used for access control. Vendors must now connect with reps to access contact details.';

COMMIT;