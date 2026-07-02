-- =============================================================
-- GMAIL — CONTAS DA EMPRESA (ORG-LEVEL)
--
-- As 2 contas Gmail (comercial + marketing) passam a ser da ORGANIZAÇÃO,
-- não do usuário que conectou:
--  * email_connections vira a entidade "conta de e-mail da org":
--    única por (org_id, provider, email_address) e uma conta ativa por
--    finalidade (org_id, purpose); ganha nome de exibição, assinatura
--    e last_synced_at por conta.
--  * Leitura para toda a org (a UI mostra o status), escrita só admin.
--  * gmail_oauth_tokens deixa de ser legível pelo cliente: tokens são
--    segredos — apenas as edge functions (service role) os acessam.
--  * emails.synced_from (conta de origem) é retro-preenchido nos enviados.
-- =============================================================

-- ---------- 1. Novas colunas por conta ----------
ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS signature_html text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ---------- 2. Unicidade org-level ----------
-- Dedup: mantém a conexão mais recente por (org, provider, email)
DELETE FROM public.email_connections ec
USING public.email_connections dup
WHERE ec.org_id = dup.org_id
  AND ec.provider = dup.provider
  AND ec.email_address = dup.email_address
  AND ec.id <> dup.id
  AND ec.connected_at < dup.connected_at;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_connections_user_provider_email_key') THEN
    ALTER TABLE public.email_connections DROP CONSTRAINT email_connections_user_provider_email_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_connections_org_provider_email_key') THEN
    ALTER TABLE public.email_connections
      ADD CONSTRAINT email_connections_org_provider_email_key UNIQUE (org_id, provider, email_address);
  END IF;
END $$;

-- Uma conta ATIVA por finalidade (slot comercial / slot marketing):
-- desativa duplicatas mais antigas antes de criar o índice
UPDATE public.email_connections ec
SET is_active = false
WHERE is_active
  AND EXISTS (
    SELECT 1 FROM public.email_connections newer
    WHERE newer.org_id = ec.org_id
      AND newer.purpose = ec.purpose
      AND newer.is_active
      AND newer.connected_at > ec.connected_at
  );

CREATE UNIQUE INDEX IF NOT EXISTS email_connections_org_purpose_active_key
  ON public.email_connections (org_id, purpose)
  WHERE is_active;

-- ---------- 3. RLS: leitura org-wide, escrita admin ----------
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('email_connections','gmail_oauth_tokens','google_oauth_tokens')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "email_connections_select" ON public.email_connections FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "email_connections_insert" ON public.email_connections FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));
CREATE POLICY "email_connections_update" ON public.email_connections FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));
CREATE POLICY "email_connections_delete" ON public.email_connections FOR DELETE
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));

-- Tokens: NENHUMA política para clientes. RLS ligado sem política = negado.
-- Somente as edge functions (service role, que ignora RLS) acessam.
ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ---------- 4. Backfill de synced_from nos e-mails enviados ----------
UPDATE public.emails
SET synced_from = from_email
WHERE synced_from IS NULL
  AND direction = 'outbound'
  AND from_email IS NOT NULL;
