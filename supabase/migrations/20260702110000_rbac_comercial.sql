-- =============================================================
-- RBAC — PAPEL COMERCIAL (role 'member')
--
-- Modelo de acesso:
--   owner/admin : veem e gerenciam TODOS os dados da organização
--   member      : "Comercial" — vê e edita APENAS os próprios registros
--                 (contacts/deals onde owner_id = ele; activities/emails
--                 onde user_id = ele). Não exclui, não exporta em massa,
--                 não acessa tabelas administrativas.
--
-- Antes desta migration a matriz role_permissions era cosmética e TODA
-- pessoa da org via/editava/excluía tudo.
-- =============================================================

-- ---------- 1. Helper: é admin ou owner da org? ----------
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role IN ('owner','admin')
  );
$$;

-- ---------- 2. Derrubar políticas antigas das tabelas afetadas ----------
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        -- escopo por dono
        'contacts','deals','activities','emails','companies','sales_goals',
        -- catálogo: leitura org, escrita admin
        'pipelines','pipeline_stages','tags','loss_reasons',
        'custom_field_definitions','email_templates','segments',
        -- somente admin
        'api_keys','org_secrets','integration_configs','webhooks',
        'automations','automation_logs','invitations',
        'meta_ad_accounts','meta_ads','meta_adsets','meta_campaigns','meta_insights','meta_sync_log',
        'whatsapp_config','whatsapp_templates','whatsapp_ai_config','whatsapp_instances',
        'whatsapp_quick_actions','whatsapp_conversations','whatsapp_messages','whatsapp_instance_secrets',
        'email_sequences','email_sequence_steps','lead_scoring_rules','risk_rules','lead_score_history'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ---------- 3. Contatos / Negócios: comercial vê só os próprios ----------
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));

CREATE POLICY "deals_select" ON public.deals FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "deals_insert" ON public.deals FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "deals_update" ON public.deals FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid()));
CREATE POLICY "deals_delete" ON public.deals FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));

-- ---------- 4. Atividades / E-mails: escopo por user_id ----------
CREATE POLICY "activities_select" ON public.activities FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "activities_insert" ON public.activities FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "activities_update" ON public.activities FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "activities_delete" ON public.activities FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));

CREATE POLICY "emails_select" ON public.emails FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "emails_insert" ON public.emails FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "emails_update" ON public.emails FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));
CREATE POLICY "emails_delete" ON public.emails FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR user_id = auth.uid()));

-- ---------- 5. Empresas: leitura org-wide (refs de contato resolvem);
--             edição dono-ou-admin; exclusão admin ----------
CREATE POLICY "companies_select" ON public.companies FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "companies_insert" ON public.companies FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND (is_org_admin(auth.uid(), org_id) OR owner_id = auth.uid() OR owner_id IS NULL))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "companies_delete" ON public.companies FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));

-- ---------- 6. Metas: comercial vê as próprias/da equipe; escrita admin ----------
CREATE POLICY "sales_goals_select" ON public.sales_goals FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND (
    is_org_admin(auth.uid(), org_id) OR user_id = auth.uid() OR assign_type <> 'individual'
  ));
CREATE POLICY "sales_goals_insert" ON public.sales_goals FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));
CREATE POLICY "sales_goals_update" ON public.sales_goals FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));
CREATE POLICY "sales_goals_delete" ON public.sales_goals FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));

-- ---------- 7. Catálogo: leitura para toda a org, escrita admin ----------
-- Tabelas que não existirem neste banco são puladas (schemas remotos podem
-- estar em versões diferentes das migrations do repositório).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pipelines','pipeline_stages','tags','loss_reasons',
    'custom_field_definitions','email_templates','segments'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe — pulando', t;
      CONTINUE;
    END IF;
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id))', t, t);
  END LOOP;
END $$;

-- ---------- 8. Tabelas administrativas: somente admin/owner ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'api_keys','org_secrets','integration_configs','webhooks',
    'automations','automation_logs','invitations',
    'meta_ad_accounts','meta_ads','meta_adsets','meta_campaigns','meta_insights','meta_sync_log',
    'whatsapp_config','whatsapp_templates','whatsapp_ai_config','whatsapp_instances',
    'whatsapp_quick_actions','whatsapp_conversations','whatsapp_messages','whatsapp_instance_secrets',
    'email_sequences','email_sequence_steps','lead_scoring_rules','risk_rules','lead_score_history'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe — pulando', t;
      CONTINUE;
    END IF;
    EXECUTE format('CREATE POLICY "%s_admin_all" ON public.%I FOR ALL USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id)) WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id))', t, t);
  END LOOP;
END $$;

-- ---------- 9. Dono automático em novos registros ----------
-- Registros criados pelo app ganham dono = criador (WITH CHECK acima passa).
-- Inserções via service role (lead-capture, sync) ficam sem dono até o
-- admin distribuir.
CREATE OR REPLACE FUNCTION public.set_default_owner_id()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.owner_id := COALESCE(NEW.owner_id, auth.uid());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_user_id()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_owner_contacts ON public.contacts;
CREATE TRIGGER set_owner_contacts BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_default_owner_id();

DROP TRIGGER IF EXISTS set_owner_companies ON public.companies;
CREATE TRIGGER set_owner_companies BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_default_owner_id();

DROP TRIGGER IF EXISTS set_owner_deals ON public.deals;
CREATE TRIGGER set_owner_deals BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_default_owner_id();

DROP TRIGGER IF EXISTS set_user_activities ON public.activities;
CREATE TRIGGER set_user_activities BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_default_user_id();

DROP TRIGGER IF EXISTS set_user_emails ON public.emails;
CREATE TRIGGER set_user_emails BEFORE INSERT ON public.emails
  FOR EACH ROW EXECUTE FUNCTION public.set_default_user_id();

-- ---------- 10. Qualificação de lead ATÔMICA ----------
-- Antes o app fazia UPDATE do status e INSERT do deal em duas chamadas:
-- se o INSERT falhasse, o lead sumia da lista sem negócio criado.
-- SECURITY INVOKER: as políticas RLS do usuário continuam valendo.
CREATE OR REPLACE FUNCTION public.qualify_lead(p_contact_id uuid, p_pipeline_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_name text;
  v_stage_id uuid;
  v_deal_id uuid;
BEGIN
  SELECT org_id, trim(concat(first_name, ' ', coalesce(last_name, '')))
    INTO v_org_id, v_name
  FROM contacts WHERE id = p_contact_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado ou sem permissão';
  END IF;

  SELECT id INTO v_stage_id
  FROM pipeline_stages
  WHERE pipeline_id = p_pipeline_id AND org_id = v_org_id
  ORDER BY "order" ASC
  LIMIT 1;

  UPDATE contacts SET status = 'prospect' WHERE id = p_contact_id;

  INSERT INTO deals (org_id, title, contact_id, stage_id, value, status)
  VALUES (v_org_id, 'Lead: ' || v_name, p_contact_id, v_stage_id, 0, 'open')
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$$;
