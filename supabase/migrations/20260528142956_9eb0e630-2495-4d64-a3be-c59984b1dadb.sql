-- Restaurar EXECUTE para funções usadas em policies RLS.
-- SECURITY DEFINER protege o conteúdo, mas o caller precisa ter EXECUTE.
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_for_user(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_org_owner(uuid, uuid) TO authenticated;