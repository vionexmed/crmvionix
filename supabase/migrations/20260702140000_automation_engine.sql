-- =============================================================
-- MOTOR DE AUTOMAÇÕES + SEQUÊNCIAS DE E-MAIL
--
-- Antes: a página Automações criava regras que NUNCA executavam
-- (nada invocava process-automation) e as Sequências nunca enviavam.
--
-- Este migration cria:
--  1. Fila de eventos (automation_events) alimentada por triggers de banco
--     em contacts / deals / activities.
--  2. Agendamento via pg_cron + pg_net: a cada 5 min o banco chama as
--     edge functions process-automation e process-sequences em modo batch.
--
-- ⚠️ REQUISITO MANUAL (uma única vez, no SQL Editor):
--   selecionar Vault → criar o segredo com a service role key:
--     select vault.create_secret('SUA_SERVICE_ROLE_KEY', 'service_role_key');
--   Sem esse segredo os jobs rodam mas não chamam as funções (no-op).
-- =============================================================

-- ---------- 1. Fila de eventos ----------
CREATE TABLE IF NOT EXISTS public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_automation_events_pending
  ON public.automation_events (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_events_admin_read" ON public.automation_events;
CREATE POLICY "automation_events_admin_read" ON public.automation_events FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id) AND is_org_admin(auth.uid(), org_id));
-- INSERTs vêm dos triggers abaixo (SECURITY DEFINER) e o processamento usa
-- service role — clientes não escrevem aqui.

-- Limpeza automática de eventos antigos processados (mantém 7 dias)
CREATE OR REPLACE FUNCTION public.cleanup_automation_events()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.automation_events
  WHERE processed_at IS NOT NULL AND processed_at < now() - interval '7 days';
$$;

-- ---------- 2. Triggers que alimentam a fila ----------
CREATE OR REPLACE FUNCTION public.enqueue_contact_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.automation_events (org_id, event_type, payload)
    VALUES (NEW.org_id, 'contact.created', jsonb_build_object(
      'contact_id', NEW.id, 'status', NEW.status, 'first_name', NEW.first_name,
      'email', NEW.email, 'owner_id', NEW.owner_id, 'lead_score', NEW.lead_score,
      'source', NEW.metadata->>'source'
    ));
  ELSIF TG_OP = 'UPDATE' AND (ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)) THEN
    INSERT INTO public.automation_events (org_id, event_type, payload)
    VALUES (NEW.org_id, 'contact.updated', jsonb_build_object(
      'contact_id', NEW.id, 'status', NEW.status, 'old_status', OLD.status,
      'email', NEW.email, 'owner_id', NEW.owner_id,
      'lead_score', NEW.lead_score, 'old_lead_score', OLD.lead_score,
      'changed_fields', (
        SELECT jsonb_agg(key) FROM jsonb_each(to_jsonb(NEW)) AS n(key, value)
        WHERE to_jsonb(OLD) -> key IS DISTINCT FROM value
      )
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_contacts_event ON public.contacts;
CREATE TRIGGER automation_contacts_event
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_contact_event();

CREATE OR REPLACE FUNCTION public.enqueue_deal_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      INSERT INTO public.automation_events (org_id, event_type, payload)
      VALUES (NEW.org_id, 'deal.stage_changed', jsonb_build_object(
        'deal_id', NEW.id, 'contact_id', NEW.contact_id, 'company_id', NEW.company_id,
        'from_stage', OLD.stage_id, 'to_stage', NEW.stage_id, 'value', NEW.value
      ));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'won' THEN
      INSERT INTO public.automation_events (org_id, event_type, payload)
      VALUES (NEW.org_id, 'deal.won', jsonb_build_object(
        'deal_id', NEW.id, 'contact_id', NEW.contact_id, 'company_id', NEW.company_id,
        'value', NEW.value, 'title', NEW.title
      ));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'lost' THEN
      INSERT INTO public.automation_events (org_id, event_type, payload)
      VALUES (NEW.org_id, 'deal.lost', jsonb_build_object(
        'deal_id', NEW.id, 'contact_id', NEW.contact_id, 'company_id', NEW.company_id,
        'value', NEW.value, 'title', NEW.title, 'loss_reason', NEW.loss_reason
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_deals_event ON public.deals;
CREATE TRIGGER automation_deals_event
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_deal_event();

CREATE OR REPLACE FUNCTION public.enqueue_activity_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.automation_events (org_id, event_type, payload)
  VALUES (NEW.org_id, 'activity.created', jsonb_build_object(
    'activity_id', NEW.id, 'activity_type', NEW.type,
    'contact_id', NEW.contact_id, 'deal_id', NEW.deal_id
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_activities_event ON public.activities;
CREATE TRIGGER automation_activities_event
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_activity_event();

-- ---------- 3. Agendamento (pg_cron + pg_net) ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_url text;
BEGIN
  -- URL do projeto (supabase hosted expõe nas settings; derivamos do request local não é possível,
  -- então usamos o padrão do projeto — ajuste se o ref mudar)
  v_url := 'https://kschuwekbrrwmhzinsrv.supabase.co/functions/v1';

  -- Remove agendamentos anteriores (idempotente)
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('process-automations', 'process-sequences', 'cleanup-automation-events');

  -- Motor de automações: a cada 5 minutos
  PERFORM cron.schedule(
    'process-automations',
    '*/5 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body := '{"scheduled": true}'::jsonb
      )
      WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key');
    $job$, v_url || '/process-automation')
  );

  -- Worker de sequências de e-mail: a cada 10 minutos
  PERFORM cron.schedule(
    'process-sequences',
    '*/10 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body := '{"scheduled": true}'::jsonb
      )
      WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key');
    $job$, v_url || '/process-sequences')
  );

  -- Limpeza diária da fila
  PERFORM cron.schedule('cleanup-automation-events', '0 4 * * *', 'SELECT public.cleanup_automation_events()');
END $$;
