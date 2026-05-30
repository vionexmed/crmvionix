
-- 1. profiles: remove org_id IS NULL exposure
DROP POLICY IF EXISTS "Users can view profiles in own org" ON public.profiles;
CREATE POLICY "Users can view profiles in own org"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR (org_id IS NOT NULL AND user_belongs_to_org(auth.uid(), org_id)));

-- 2. invitations: restrict SELECT to owners/admins
DROP POLICY IF EXISTS "Org members can view invitations" ON public.invitations;
CREATE POLICY "Admins can view invitations"
ON public.invitations FOR SELECT TO authenticated
USING (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role));

-- 3. gmail_oauth_tokens: explicit INSERT/UPDATE policies tied to owner
DROP POLICY IF EXISTS "Users insert own gmail tokens" ON public.gmail_oauth_tokens;
CREATE POLICY "Users insert own gmail tokens"
ON public.gmail_oauth_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own gmail tokens" ON public.gmail_oauth_tokens;
CREATE POLICY "Users update own gmail tokens"
ON public.gmail_oauth_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. org_secrets: owner/admin only
DROP POLICY IF EXISTS "Owners admins read org_secrets" ON public.org_secrets;
DROP POLICY IF EXISTS "Owners admins write org_secrets" ON public.org_secrets;
CREATE POLICY "Owners admins read org_secrets"
ON public.org_secrets FOR SELECT TO authenticated
USING (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role));
CREATE POLICY "Owners admins write org_secrets"
ON public.org_secrets FOR ALL TO authenticated
USING (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role));

-- 5. whatsapp_config: restrict SELECT to owners/admins (webhook token)
DROP POLICY IF EXISTS "Org members can view whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Owners admins view whatsapp config"
ON public.whatsapp_config FOR SELECT TO authenticated
USING (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role));

-- 6. user_roles: prevent granting roles to users outside org
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;
CREATE POLICY "Owners can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), org_id, 'owner'::app_role)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.org_id = user_roles.org_id)
);

-- 7. storage policies — email-logos scoped to uploader's folder
DROP POLICY IF EXISTS "email_logos_authed_write" ON storage.objects;
DROP POLICY IF EXISTS "email_logos_authed_update" ON storage.objects;
DROP POLICY IF EXISTS "email_logos_authed_delete" ON storage.objects;

CREATE POLICY "email_logos_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "email_logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'email-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'email-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "email_logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'email-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8. whatsapp-media INSERT scoped to uploader's folder
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp media" ON storage.objects;
CREATE POLICY "Users can upload own whatsapp media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 9. Revoke direct EXECUTE on SECURITY DEFINER helpers from clients
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(uuid, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_org_owner(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_invitation_accepted() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
