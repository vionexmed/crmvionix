-- =============================================================
-- CORREÇÃO CRÍTICA DE ISOLAMENTO DE TENANT
--
-- Antes: qualquer cadastro novo era anexado à PRIMEIRA organização
-- do banco (SELECT ... LIMIT 1) como 'member', vendo todos os dados
-- daquela empresa. O papel escolhido no convite também era ignorado.
--
-- Agora:
--  1. Usuário com convite pendente (tabela invitations — só gravável
--     por owner/admin ou service role, portanto confiável) entra na
--     org do convite COM o papel convidado e pula o onboarding de empresa.
--  2. Cadastro espontâneo cria a PRÓPRIA organização como owner.
--     Nunca entra na org de outro tenant.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_user_name text;
  v_invited_org uuid;
  v_invited_role app_role;
  v_slug text;
BEGIN
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Convite pendente é a fonte da verdade (não confiamos em raw_user_meta_data,
  -- que pode ser definido pelo próprio cliente no signUp)
  SELECT i.org_id, i.role
    INTO v_invited_org, v_invited_role
  FROM public.invitations i
  WHERE lower(i.email) = lower(NEW.email)
    AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_invited_org IS NOT NULL THEN
    -- Usuário convidado: entra na org do convite com o papel convidado.
    -- Onboarding de empresa é pulado (a org já existe e não deve ser renomeada).
    INSERT INTO public.profiles (id, email, name, avatar_url, org_id, onboarding_completed, onboarding_step)
    VALUES (NEW.id, NEW.email, v_user_name, NEW.raw_user_meta_data->>'avatar_url', v_invited_org, true, 1)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.profiles SET org_id = v_invited_org WHERE id = NEW.id AND org_id IS NULL;

    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, v_invited_org, COALESCE(v_invited_role, 'member'))
    ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role;
  ELSE
    -- Cadastro espontâneo: cria a própria organização como owner.
    INSERT INTO public.profiles (id, email, name, avatar_url, onboarding_completed, onboarding_step)
    VALUES (NEW.id, NEW.email, v_user_name, NEW.raw_user_meta_data->>'avatar_url', false, 1)
    ON CONFLICT (id) DO NOTHING;

    -- Slug único por usuário (organizations.slug é UNIQUE)
    v_slug := 'empresa-' || replace(substr(NEW.id::text, 1, 13), '-', '');

    INSERT INTO public.organizations (name, slug, settings)
    VALUES ('Minha Empresa', v_slug, '{"timezone":"America/Sao_Paulo","currency":"BRL"}'::jsonb)
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO v_org_id FROM public.organizations WHERE slug = v_slug;

    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, v_org_id, 'owner')
    ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

    UPDATE public.profiles SET org_id = v_org_id WHERE id = NEW.id AND org_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Aceite do convite: comparação case-insensitive
CREATE OR REPLACE FUNCTION public.mark_invitation_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public' AS $$
BEGIN
  UPDATE public.invitations
  SET accepted_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL;
  RETURN NEW;
END;
$$;
