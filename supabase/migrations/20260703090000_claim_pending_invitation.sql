-- =============================================================
-- AUTO-CURA DO FLUXO DE CONVITE
--
-- Sintoma corrigido: convidado recebia o e-mail mas, ao entrar, caía no
-- cadastro de empresa (onboarding) em vez de entrar na org do convite.
-- Causa: se o usuário auth é criado sem o convite registrado ainda
-- (versão antiga do invite-member publicada, ou cadastro espontâneo
-- anterior ao convite), o trigger handle_new_user cria uma org própria.
--
-- Esta RPC é chamada pelo app a cada login: se existe convite pendente
-- para o e-mail do usuário E ele está "solto" (sem org, ou numa org
-- auto-criada vazia), ele é movido para a org do convite com o papel
-- convidado, o onboarding é pulado e a org órfã é removida.
-- =============================================================

CREATE OR REPLACE FUNCTION public.claim_pending_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv RECORD;
  v_current_org uuid;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_authenticated');
  END IF;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = '' THEN
    SELECT lower(email) INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_email');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE lower(email) = v_email AND accepted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_pending_invitation');
  END IF;

  SELECT org_id INTO v_current_org FROM public.profiles WHERE id = v_uid;

  -- Já está na org do convite: só garante papel e marca aceito
  IF v_current_org = v_inv.org_id THEN
    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (v_uid, v_inv.org_id, coalesce(v_inv.role, 'member'))
    ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role;
    UPDATE public.profiles SET onboarding_completed = true WHERE id = v_uid;
    UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;
    RETURN jsonb_build_object('claimed', true, 'org_id', v_inv.org_id, 'role', v_inv.role);
  END IF;

  -- Segurança: NÃO move quem já participa de uma org "de verdade"
  -- (com dados ou com outros membros) — nesse caso o admin resolve manualmente.
  IF v_current_org IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.contacts WHERE org_id = v_current_org)
       OR (SELECT count(*) FROM public.user_roles WHERE org_id = v_current_org) > 1 THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'user_already_in_active_org');
    END IF;
  END IF;

  -- Move para a org do convite com o papel convidado, pulando onboarding
  UPDATE public.profiles
  SET org_id = v_inv.org_id, onboarding_completed = true
  WHERE id = v_uid;

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (v_uid, v_inv.org_id, coalesce(v_inv.role, 'member'))
  ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role;

  -- Remove papéis em outras orgs e apaga a org auto-criada se ficou órfã
  FOR r IN
    SELECT DISTINCT org_id FROM public.user_roles
    WHERE user_id = v_uid AND org_id <> v_inv.org_id
  LOOP
    DELETE FROM public.user_roles WHERE user_id = v_uid AND org_id = r.org_id;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE org_id = r.org_id)
       AND NOT EXISTS (SELECT 1 FROM public.contacts WHERE org_id = r.org_id) THEN
      DELETE FROM public.organizations WHERE id = r.org_id;
    END IF;
  END LOOP;

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object('claimed', true, 'org_id', v_inv.org_id, 'role', v_inv.role);
END;
$$;
