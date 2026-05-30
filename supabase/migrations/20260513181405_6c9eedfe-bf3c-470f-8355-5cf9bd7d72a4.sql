
-- Drop legacy WhatsApp tables (non-official QR-based)
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS public.whatsapp_quick_actions CASCADE;
DROP TABLE IF EXISTS public.whatsapp_ai_config CASCADE;
DROP TABLE IF EXISTS public.whatsapp_instance_secrets CASCADE;
DROP TABLE IF EXISTS public.whatsapp_instances CASCADE;

-- WhatsApp Config (1 per org)
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  phone_number_id text NOT NULL,
  waba_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  webhook_verify_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view whatsapp config" ON public.whatsapp_config
  FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Owners/admins manage whatsapp config" ON public.whatsapp_config
  FOR ALL USING (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), org_id, 'owner'::app_role) OR has_role(auth.uid(), org_id, 'admin'::app_role));
CREATE TRIGGER update_whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WhatsApp Messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  contact_id uuid,
  deal_id uuid,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  wa_message_id text UNIQUE,
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text,
  message_type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_message text,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_messages_org ON public.whatsapp_messages(org_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_contact ON public.whatsapp_messages(contact_id, created_at DESC);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view whatsapp messages" ON public.whatsapp_messages
  FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members insert whatsapp messages" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members update whatsapp messages" ON public.whatsapp_messages
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members delete whatsapp messages" ON public.whatsapp_messages
  FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

-- WhatsApp Templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text,
  status text,
  components jsonb DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name, language)
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view whatsapp templates" ON public.whatsapp_templates
  FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members manage whatsapp templates" ON public.whatsapp_templates
  FOR ALL USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
