
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initialize_org_owner(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_invitation_accepted() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO service_role;
