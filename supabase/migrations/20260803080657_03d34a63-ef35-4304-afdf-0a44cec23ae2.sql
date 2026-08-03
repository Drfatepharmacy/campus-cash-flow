REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_association_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_assoc_permission(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.expire_role_assignments() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_association_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_assoc_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_role_assignments() TO service_role;