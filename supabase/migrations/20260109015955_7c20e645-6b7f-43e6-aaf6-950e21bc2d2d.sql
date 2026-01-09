CREATE OR REPLACE VIEW public.connected_rep_display_info AS
SELECT 
  vc.vendor_id,
  vc.field_rep_id AS rep_id,
  COALESCE(NULLIF(TRIM(p.full_name), ''), rp.anonymous_id) AS rep_display_name,
  rp.anonymous_id AS rep_anonymous_label,
  rp.city AS rep_city,
  rp.state AS rep_state
FROM public.vendor_connections vc
JOIN public.rep_profile rp ON rp.user_id = vc.field_rep_id
JOIN public.profiles p ON p.id = vc.field_rep_id
WHERE vc.status = 'connected'::public.vendor_connection_status
  AND (vc.vendor_id = auth.uid() OR vc.field_rep_id = auth.uid());

GRANT SELECT ON public.connected_rep_display_info TO authenticated;

COMMENT ON VIEW public.connected_rep_display_info IS
'Secure view exposing rep display names for connected vendor-rep pairs only. No contact details exposed. Row-filtered by auth.uid() to ensure only connected parties can access.';