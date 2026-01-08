ALTER FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_dual_role_access_request(uuid, text, text, boolean, text) TO authenticated;

ALTER FUNCTION public.set_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

ALTER FUNCTION public.protect_dual_role_access_request_user_updates() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_dual_role_access_request_user_updates() FROM PUBLIC;