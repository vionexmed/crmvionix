import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MessageSquare, Webhook, Key, Code, Plus, Trash2, Copy,
  Check, ExternalLink, RefreshCw, Eye, EyeOff, Loader2, Globe, Mail, BookOpen, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LogoUploadField } from "@/components/crm/LogoUploadField";
import { WhatsAppOfficialCard } from "@/components/crm/WhatsAppOfficialCard";

// ── Types ──
type IntegrationConfig = {
  id: string; org_id: string; provider: string; config: any; is_active: boolean;
  connected_at: string | null; connected_by: string | null;
};
type ApiKey = {
  id: string; org_id: string; name: string; key_prefix: string; key_hash: string;
  created_at: string | null; last_used_at: string | null; is_active: boolean; request_count: number;
};
type WebhookRow = {
  id: string; org_id: string; name: string; url: string; events: string[];
  secret: string | null; is_active: boolean; created_at: string | null;
  last_triggered_at: string | null; failure_count: number;
};

const WEBHOOK_EVENTS = [
  { value: "deal.won", label: "Negócio Ganho" },
  { value: "deal.lost", label: "Negócio Perdido" },
  { value: "deal.stage_changed", label: "Mudança de Stage" },
  { value: "contact.created", label: "Contato Criado" },
  { value: "deal.created", label: "Negócio Criado" },
  { value: "activity.created", label: "Atividade Criada" },
];

export default function Integrations() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações & API</h1>
        <p className="text-muted-foreground">Conecte ferramentas externas e gerencie sua API</p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList className="flex-wrap">
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="lead-capture">Captação de Leads</TabsTrigger>
          <TabsTrigger value="tracking">Rastreamento</TabsTrigger>
          <TabsTrigger value="import-export">Import/Export</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab orgId={orgId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <ApiKeysTab orgId={orgId} userId={user?.id} />
        </TabsContent>
        <TabsContent value="lead-capture" className="mt-4">
          <LeadCaptureTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="tracking" className="mt-4">
          <TrackingTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="import-export" className="mt-4">
          <ImportExportTab orgId={orgId} userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Integrations Tab ──
function IntegrationsTab({ orgId, userId }: { orgId: string | null; userId?: string }) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [editProvider, setEditProvider] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<any>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const fetchConfigs = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("integration_configs").select("*").eq("org_id", orgId) as any;
    setConfigs(data || []);
  }, [orgId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const getConfig = (provider: string) => configs.find((c) => c.provider === provider);

  const saveConfig = async (provider: string) => {
    if (!orgId) return;
    if (provider === "gmail") {
      // Save optional credentials, display name and signature fields; OAuth handled by Conectar
      const existing = getConfig("gmail");
      const sigKeys = ["client_id","client_secret","from_name","signature","signature_name","signature_role","signature_company","signature_phone","signature_email","signature_website","signature_extra","signature_logo_url"];
      const merged: any = { ...(existing?.config || {}) };
      for (const k of sigKeys) merged[k] = editConfig[k] ?? merged[k] ?? null;
      if (existing) {
        await supabase.from("integration_configs").update({ config: merged } as any).eq("id", existing.id);
      } else {
        await supabase.from("integration_configs").insert({ org_id: orgId, provider: "gmail", config: merged, connected_by: userId } as any);
      }
      toast({ title: "Configurações do Gmail salvas" });
      setEditProvider(null);
      fetchConfigs();
      return;
    }
    const existing = getConfig(provider);
    if (existing) {
      await supabase.from("integration_configs").update({ config: editConfig, is_active: true } as any).eq("id", existing.id);
    } else {
      await supabase.from("integration_configs").insert({ org_id: orgId, provider, config: editConfig, connected_by: userId } as any);
    }
    toast({ title: `${provider} configurado` });
    setEditProvider(null);
    fetchConfigs();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("integration_configs").update({ is_active: active } as any).eq("id", id);
    fetchConfigs();
  };

  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackChannels, setSlackChannels] = useState<{ id: string; name: string }[]>([]);
  const [slackWorkspace, setSlackWorkspace] = useState<string | null>(null);
  const [slackSetupGuide, setSlackSetupGuide] = useState(false);

  const handleSlackConnect = async () => {
    if (!orgId) return;
    setSlackConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-connect", {
        body: { org_id: orgId },
      });
      if (error) throw error;
      if (data?.error?.includes("API_KEY")) {
        setSlackSetupGuide(true);
        setSlackConnecting(false);
        return;
      }
      if (data?.workspace_name) {
        setSlackWorkspace(data.workspace_name);
        setSlackChannels(data.channels || []);
        toast({ title: `Conectado ao workspace ${data.workspace_name}` });
        fetchConfigs();
      } else {
        setSlackSetupGuide(true);
      }
    } catch {
      setSlackSetupGuide(true);
    }
    setSlackConnecting(false);
  };

  const [gmailConnecting, setGmailConnecting] = useState(false);
  const handleGmailConnect = async () => {
    if (!orgId) return;
    setGmailConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
        body: { org_id: orgId, return_to: `${window.location.origin}/settings/integrations` },
      });
      if (error || !data?.url) {
        toast({ title: "Falha ao iniciar OAuth", description: data?.error || error?.message || "Erro desconhecido", variant: "destructive" });
        setGmailConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setGmailConnecting(false);
    }
  };

  const integrations = [
    {
      provider: "gmail", name: "Gmail", icon: Mail,
      description: "Conecte sua conta Google via OAuth (suas credenciais)",
      connectAction: handleGmailConnect,
      connectLoading: gmailConnecting,
      fields: [
        { key: "client_id", label: "Google OAuth Client ID", placeholder: "xxxxxxx.apps.googleusercontent.com", type: "secret" as const,
          helpText: "Crie credenciais OAuth 2.0 em",
          helpUrl: "https://console.cloud.google.com/apis/credentials",
          helpLabel: "Google Cloud Console" },
        { key: "client_secret", label: "Google OAuth Client Secret", placeholder: "GOCSPX-...", type: "secret" as const },
        { key: "from_name", label: "Nome de exibição (opcional)", placeholder: "Equipe Comercial" },
        { key: "_signature_section", label: "Assinatura de email", type: "section" as const },
        { key: "signature_logo_url", label: "Logo da assinatura", type: "logo" as const },
        { key: "signature_name", label: "Nome", placeholder: "João Silva" },
        { key: "signature_role", label: "Cargo", placeholder: "Diretor Comercial" },
        { key: "signature_company", label: "Empresa", placeholder: "Minha Empresa Ltda" },
        { key: "signature_phone", label: "Telefone", placeholder: "+55 11 99999-9999" },
        { key: "signature_email", label: "E-mail", placeholder: "joao@empresa.com" },
        { key: "signature_website", label: "Website", placeholder: "https://empresa.com" },
        { key: "signature_extra", label: "Texto adicional (opcional)", placeholder: "Endereço, redes sociais, etc.", type: "textarea" as const },
      ],
    },
    {
      provider: "slack", name: "Slack", icon: MessageSquare,
      description: "Notificações de negócios e resumo diário no canal",
      connectAction: handleSlackConnect,
      connectLoading: slackConnecting,
      fields: [
        { key: "channel", label: "Canal de notificações", placeholder: "#vendas" },
        { key: "daily_summary", label: "Resumo diário às 9h", type: "switch" },
        { key: "notify_won", label: "Notificar negócio ganho", type: "switch" },
        { key: "notify_lost", label: "Notificar negócio perdido", type: "switch" },
      ],
    },
    {
      provider: "zapier", name: "Zapier / Make", icon: Webhook,
      description: "Webhooks de saída e entrada para automação",
      fields: [
        { key: "outbound_url", label: "Webhook URL de saída", placeholder: "https://hooks.zapier.com/..." },
        { key: "events", label: "Eventos", placeholder: "deal.won, deal.lost, contact.created" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <WhatsAppOfficialCard />
        {integrations.map((intg) => {
          const cfg = getConfig(intg.provider);
          const Icon = intg.icon;
          return (
            <Card key={intg.provider}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{intg.name}</CardTitle>
                      <CardDescription className="text-[10px]">{intg.description}</CardDescription>
                    </div>
                  </div>
                  {cfg && <Switch checked={cfg.is_active} onCheckedChange={(v) => toggleActive(cfg.id, v)} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {cfg ? (
                    <>
                      <Badge variant={cfg.is_active ? "default" : "secondary"} className="text-[9px]">
                        {cfg.is_active ? "Conectado" : "Inativo"}
                      </Badge>
                      <Button variant="outline" size="sm" className="ml-auto h-7 text-[10px]"
                        onClick={async () => {
                          setEditProvider(intg.provider);
                          let base = cfg.config || {};
                          if (intg.provider === "gmail" && (!base.client_id || !base.client_secret)) {
                            try {
                              const { data } = await supabase.functions.invoke("gmail-get-defaults");
                              if (data) base = { client_id: base.client_id || data.client_id, client_secret: base.client_secret || data.client_secret, ...base };
                            } catch { /* ignore */ }
                          }
                          setEditConfig(base);
                        }}>
                        Configurar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="h-7 text-[10px]"
                      disabled={intg.connectLoading}
                      onClick={async () => {
                        if (intg.connectAction) return intg.connectAction();
                        setEditProvider(intg.provider);
                        let base: any = {};
                        if (intg.provider === "gmail") {
                          try {
                            const { data } = await supabase.functions.invoke("gmail-get-defaults");
                            if (data) base = { client_id: data.client_id, client_secret: data.client_secret };
                          } catch { /* ignore */ }
                        }
                        setEditConfig(base);
                      }}>
                      {intg.connectLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Conectando...</> : <><Plus className="mr-1 h-3 w-3" />Conectar</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Dialog */}
      <Dialog open={!!editProvider} onOpenChange={() => setEditProvider(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Configurar {integrations.find((i) => i.provider === editProvider)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editProvider === "gmail" && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                Use <strong>Conectar</strong> no card para autorizar via Google OAuth. Os campos abaixo são opcionais — preencha sua assinatura com logo e dados de contato para aparecer em todos os emails enviados.
              </div>
            )}
            {integrations.find((i) => i.provider === editProvider)?.fields.map((field) => {
              if (field.type === "section") {
                return (
                  <div key={field.key} className="pt-2 mt-2 border-t border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                  </div>
                );
              }
              return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{field.label}</Label>
                {field.type === "switch" ? (
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editConfig[field.key]} onCheckedChange={(v) => setEditConfig({ ...editConfig, [field.key]: v })} />
                    <span className="text-xs text-muted-foreground">{editConfig[field.key] ? "Sim" : "Não"}</span>
                  </div>
                ) : field.type === "textarea" ? (
                  <Textarea value={editConfig[field.key] || ""} onChange={(e) => setEditConfig({ ...editConfig, [field.key]: e.target.value })}
                    placeholder={field.placeholder} className="text-xs min-h-[80px]" />
                ) : field.type === "logo" ? (
                  <LogoUploadField
                    value={editConfig[field.key] || ""}
                    onChange={(url) => setEditConfig({ ...editConfig, [field.key]: url })}
                  />
                ) : field.type === "secret" || ["client_secret", "refresh_token", "client_id"].includes(field.key) ? (
                  <div className="relative">
                    <Input
                      type={revealed[field.key] ? "text" : "password"}
                      value={editConfig[field.key] || ""}
                      onChange={(e) => setEditConfig({ ...editConfig, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="h-8 text-xs pr-8 font-mono"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setRevealed((s) => ({ ...s, [field.key]: !s[field.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={revealed[field.key] ? "Ocultar" : "Mostrar"}
                    >
                      {revealed[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={editConfig[field.key] || ""}
                    onChange={(e) => setEditConfig({ ...editConfig, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="h-8 text-xs"
                  />
                )}
                {(field as any).helpUrl && (
                  <p className="text-[10px] text-muted-foreground">
                    {(field as any).helpText}{" "}
                    <a href={(field as any).helpUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                      {(field as any).helpLabel}
                    </a>
                  </p>
                )}
              </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditProvider(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => editProvider && saveConfig(editProvider)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slack Setup Guide */}
      <Dialog open={slackSetupGuide} onOpenChange={setSlackSetupGuide}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Configurar integração com o Slack
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para conectar o Slack ao VIONEX, siga os passos abaixo:
            </p>

            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <div>
                  <p className="text-sm font-medium">Acesse as configurações do projeto no Lovable</p>
                  <p className="text-xs text-muted-foreground">Clique no nome do projeto (canto superior esquerdo) → "Settings"</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <div>
                  <p className="text-sm font-medium">Vá em "Connectors"</p>
                  <p className="text-xs text-muted-foreground">Na aba de conectores, procure por "Slack" e clique em "Connect"</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <div>
                  <p className="text-sm font-medium">Autorize o acesso ao seu workspace</p>
                  <p className="text-xs text-muted-foreground">Selecione o workspace do Slack e autorize as permissões necessárias (enviar mensagens, listar canais)</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <div>
                  <p className="text-sm font-medium">Volte aqui e clique em "Conectar"</p>
                  <p className="text-xs text-muted-foreground">Após vincular o conector, o VIONEX detectará automaticamente seus canais</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Permissões necessárias:</strong> <code className="text-[10px] bg-muted px-1 rounded">chat:write</code> <code className="text-[10px] bg-muted px-1 rounded">channels:read</code> <code className="text-[10px] bg-muted px-1 rounded">channels:history</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSlackSetupGuide(false)}>Fechar</Button>
            <Button size="sm" onClick={() => { setSlackSetupGuide(false); handleSlackConnect(); }}>
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function WebhooksTab({ orgId }: { orgId: string | null }) {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[], secret: "" });

  const fetchWebhooks = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("webhooks").select("*").eq("org_id", orgId) as any;
    setWebhooks(data || []);
  }, [orgId]);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const createWebhook = async () => {
    if (!orgId || !form.name || !form.url) return;
    await supabase.from("webhooks").insert({
      org_id: orgId, name: form.name, url: form.url, events: form.events,
      secret: form.secret || null,
    } as any);
    toast({ title: "Webhook criado" });
    setShowCreate(false);
    setForm({ name: "", url: "", events: [], secret: "" });
    fetchWebhooks();
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from("webhooks").delete().eq("id", id);
    toast({ title: "Webhook excluído" });
    fetchWebhooks();
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    await supabase.from("webhooks").update({ is_active: active } as any).eq("id", id);
    fetchWebhooks();
  };

  const inboundUrl = orgId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`
    : "";

  return (
    <div className="space-y-4">
      {/* Outbound Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Webhooks de Saída</CardTitle>
              <CardDescription className="text-[10px]">Envie notificações para URLs externas quando eventos ocorrerem</CardDescription>
            </div>
            <Button size="sm" className="h-7 text-[10px]" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-3 w-3" />Novo Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum webhook configurado</p>
          ) : (
            <div className="space-y-2">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wh.name}</span>
                      <Badge variant={wh.is_active ? "default" : "secondary"} className="text-[8px]">
                        {wh.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{wh.url}</p>
                    <div className="flex gap-1 mt-1">
                      {wh.events?.map((e) => (
                        <Badge key={e} variant="outline" className="text-[7px]">{e}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={wh.is_active} onCheckedChange={(v) => toggleWebhook(wh.id, v)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteWebhook(wh.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inbound Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Webhook de Entrada</CardTitle>
          <CardDescription className="text-[10px]">
            Receba dados de ferramentas externas (Zapier, Make, etc.) via POST
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={inboundUrl} readOnly className="h-8 text-[10px] font-mono" />
              <Button variant="outline" size="sm" className="h-8"
                onClick={() => { navigator.clipboard.writeText(inboundUrl); toast({ title: "Copiado!" }); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-[10px] text-muted-foreground mb-1 font-medium">Payload esperado (JSON POST):</p>
            <pre className="text-[9px] font-mono text-muted-foreground">{`{
  "entity": "contact",
  "action": "create",
  "data": {
    "first_name": "João",
    "email": "joao@empresa.com"
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Novo Webhook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Zapier — Deals Ganhos" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://hooks.zapier.com/..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secret (para HMAC)</Label>
              <Input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="Opcional" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eventos</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2 text-[10px]">
                    <Checkbox
                      checked={form.events.includes(ev.value)}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          events: checked
                            ? [...form.events, ev.value]
                            : form.events.filter((e) => e !== ev.value),
                        });
                      }}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button size="sm" onClick={createWebhook}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── API Keys Tab ──
function ApiKeysTab({ orgId, userId }: { orgId: string | null; userId?: string }) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("Default");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("api_keys").select("*").eq("org_id", orgId) as any;
    setKeys(data || []);
  }, [orgId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const generateKey = async () => {
    if (!orgId) return;
    // Generate a random API key
    const rawKey = `fc_${crypto.randomUUID().replace(/-/g, "")}`;
    const prefix = rawKey.slice(0, 8);
    // Hash it (simplified — in production use edge function)
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("api_keys").insert({
      org_id: orgId, name: newKeyName, key_hash: hashHex, key_prefix: prefix, created_by: userId,
    } as any);

    if (error) { 
      const msg = error.message.includes("policy") || error.code === "42501" 
        ? "Sem permissão. Apenas Owners e Admins podem gerar API keys." 
        : error.message;
      toast({ title: "Erro ao gerar chave", description: msg, variant: "destructive" }); 
      return; 
    }
    setGeneratedKey(rawKey);
    setShowKey(true);
    fetchKeys();
    toast({ title: "API Key gerada" });
  };

  const revokeKey = async (id: string) => {
    await supabase.from("api_keys").update({ is_active: false } as any).eq("id", id);
    toast({ title: "Chave revogada" });
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast({ title: "Chave excluída" });
    fetchKeys();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">API Keys</CardTitle>
              <CardDescription className="text-[10px]">
                Gere chaves para acessar a API REST do CRM. Rate limit: 1000 req/hora.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Nome da chave" className="h-8 text-xs flex-1" />
            <Button size="sm" className="h-8 text-xs" onClick={generateKey}>
              <Key className="mr-1 h-3 w-3" />Gerar Chave
            </Button>
          </div>

          {generatedKey && showKey && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
              <p className="text-[10px] font-medium text-warning">⚠️ Copie esta chave agora — ela não será exibida novamente</p>
              <div className="flex gap-2">
                <Input value={generatedKey} readOnly className="h-8 text-[10px] font-mono" />
                <Button variant="outline" size="sm" className="h-8"
                  onClick={() => { navigator.clipboard.writeText(generatedKey); toast({ title: "Copiado!" }); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[9px]"
                onClick={() => { setShowKey(false); setGeneratedKey(null); }}>
                Esconder
              </Button>
            </div>
          )}

          {keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Nome</TableHead>
                  <TableHead className="text-[10px]">Prefixo</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Requests</TableHead>
                  <TableHead className="text-[10px]">Criada</TableHead>
                  <TableHead className="text-[10px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-xs">{k.name}</TableCell>
                    <TableCell className="text-xs font-mono">{k.key_prefix}...</TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? "default" : "destructive"} className="text-[8px]">
                        {k.is_active ? "Ativa" : "Revogada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{k.request_count}</TableCell>
                    <TableCell className="text-xs">{k.created_at ? new Date(k.created_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {k.is_active && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => revokeKey(k.id)}>
                            <EyeOff className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteKey(k.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Docs link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentação da API</CardTitle>
          <CardDescription className="text-[10px]">
            Endpoints REST disponíveis: contacts, companies, deals, activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 space-y-3">
            <p className="text-[10px] font-medium">Base URL</p>
            <code className="text-[10px] font-mono bg-background px-2 py-1 rounded">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api
            </code>

            <div className="grid gap-2 mt-3">
              {["GET /contacts", "POST /contacts", "PUT /contacts/:id", "DELETE /contacts/:id",
                "GET /companies", "POST /companies", "GET /deals", "POST /deals",
                "GET /activities", "POST /activities"].map((endpoint) => (
                <div key={endpoint} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[8px] w-12 justify-center">
                    {endpoint.split(" ")[0]}
                  </Badge>
                  <code className="text-[9px] font-mono text-muted-foreground">{endpoint.split(" ")[1]}</code>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-muted-foreground mt-2">
              Headers: <code className="bg-background px-1 rounded">Authorization: Bearer fc_xxx</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Lead Capture Tab ──
function LeadCaptureTab({ orgId }: { orgId: string | null }) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("api_keys").select("id,key_prefix,name,is_active").eq("org_id", orgId).then(({ data }) => {
      setApiKeys((data as any) || []);
    });
    supabase.from("pipelines").select("id,name").eq("org_id", orgId).then(({ data }) => {
      setPipelines((data as any) || []);
    });
  }, [orgId]);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const endpoint = `${baseUrl}/functions/v1/lead-capture`;
  const activeKey = apiKeys.find((k) => k.is_active);
  const keyPlaceholder = activeKey ? `${activeKey.key_prefix}...` : "fc_SUA_CHAVE_AQUI";

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const curlExample = `curl -X POST "${endpoint}" \\
  -H "X-Api-Key: ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "(11) 99999-9999",
    "source": "landing_page",
    "utm_source": "google",
    "utm_campaign": "campanha-maio"
  }'`;

  const fetchExample = `// Cole no seu site ou landing page
fetch("${endpoint}", {
  method: "POST",
  headers: {
    "X-Api-Key": "${keyPlaceholder}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: document.getElementById("nome").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("telefone").value,
    source: "minha-landing-page",
    utm_source: new URLSearchParams(location.search).get("utm_source") || "",
    utm_campaign: new URLSearchParams(location.search).get("utm_campaign") || ""
  })
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    // Redirecionar ou mostrar mensagem de sucesso
    window.location.href = "/obrigado";
  }
});`;

  const htmlFormExample = `<!DOCTYPE html>
<html>
<head><title>Formulário de Lead</title></head>
<body>
  <form id="lead-form">
    <input id="nome" placeholder="Seu nome" required />
    <input id="email" type="email" placeholder="Seu e-mail" required />
    <input id="telefone" placeholder="Seu telefone" />
    <button type="submit">Quero saber mais</button>
  </form>

  <script>
    document.getElementById("lead-form").addEventListener("submit", async function(e) {
      e.preventDefault();
      const res = await fetch("${endpoint}", {
        method: "POST",
        headers: {
          "X-Api-Key": "${keyPlaceholder}",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: document.getElementById("nome").value,
          email: document.getElementById("email").value,
          phone: document.getElementById("telefone").value,
          source: "landing_page"
        })
      });
      const data = await res.json();
      if (data.success) alert("Lead capturado com sucesso!");
    });
  </script>
</body>
</html>`;

  const phpExample = `<?php
$apiKey = "${keyPlaceholder}";
$endpoint = "${endpoint}";

$data = [
  "name"     => $_POST["nome"],
  "email"    => $_POST["email"],
  "phone"    => $_POST["telefone"],
  "source"   => "site-php",
  "utm_source"   => $_GET["utm_source"] ?? "",
  "utm_campaign" => $_GET["utm_campaign"] ?? "",
];

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "X-Api-Key: $apiKey",
  "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response["success"]) {
  header("Location: /obrigado.php");
}
?>`;

  const withPipelineExample = `// Criar lead E negócio ao mesmo tempo
fetch("${endpoint}", {
  method: "POST",
  headers: { "X-Api-Key": "${keyPlaceholder}", "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Maria Souza",
    email: "maria@empresa.com",
    company: "Empresa XYZ",
    source: "webinar",
    pipeline_id: "${pipelines[0]?.id || "ID_DO_PIPELINE"}",
    deal_name: "Lead do Webinar - Maria Souza",
    deal_value: 0,
    tags: ["webinar", "interesse-alto"],
    utm_source: "email",
    utm_campaign: "webinar-maio"
  })
});`;

  const fields = [
    { name: "name", type: "string", req: false, desc: "Nome completo (alternativa a first_name)" },
    { name: "first_name", type: "string", req: true, desc: "Primeiro nome (obrigatório se name não fornecido)" },
    { name: "last_name", type: "string", req: false, desc: "Sobrenome" },
    { name: "email", type: "string", req: false, desc: "E-mail do lead" },
    { name: "phone", type: "string", req: false, desc: "Telefone" },
    { name: "company", type: "string", req: false, desc: "Nome da empresa (cria ou vincula automaticamente)" },
    { name: "source", type: "string", req: false, desc: "Origem do lead (ex: 'landing_page_hero')" },
    { name: "notes", type: "string", req: false, desc: "Notas ou mensagem do lead" },
    { name: "pipeline_id", type: "uuid", req: false, desc: "ID do pipeline — cria um negócio automaticamente" },
    { name: "deal_name", type: "string", req: false, desc: "Título do negócio (padrão: 'Lead: Nome')" },
    { name: "deal_value", type: "number", req: false, desc: "Valor do negócio (padrão: 0)" },
    { name: "tags", type: "string[]", req: false, desc: "Tags para aplicar ao contato" },
    { name: "utm_source", type: "string", req: false, desc: "Parâmetro UTM source" },
    { name: "utm_medium", type: "string", req: false, desc: "Parâmetro UTM medium" },
    { name: "utm_campaign", type: "string", req: false, desc: "Parâmetro UTM campaign" },
    { name: "utm_content", type: "string", req: false, desc: "Parâmetro UTM content" },
    { name: "utm_term", type: "string", req: false, desc: "Parâmetro UTM term" },
    { name: "custom_fields", type: "object", req: false, desc: "Campos customizados (armazenados em metadata)" },
  ];

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative">
      <pre className="rounded-md bg-muted p-4 text-[9px] font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
        {code}
      </pre>
      <Button
        variant="outline" size="sm"
        className="absolute top-2 right-2 h-7 text-[9px]"
        onClick={() => copy(code, id)}
      >
        {copiedId === id ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
        {copiedId === id ? "Copiado!" : "Copiar"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            API de Captação de Leads
          </CardTitle>
          <CardDescription className="text-[10px]">
            Endpoint dedicado para receber leads de landing pages, formulários e qualquer sistema externo.
            Cria o contato automaticamente no CRM com status <strong>Lead</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Badge variant="default" className="text-[9px] shrink-0">POST</Badge>
            <code className="text-[10px] font-mono break-all">{endpoint}</code>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copy(endpoint, "url")}>
              {copiedId === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Key className="h-3 w-3" />
            <span>Autenticação: header <code className="bg-muted px-1 rounded">X-Api-Key: sua_chave</code></span>
            {!activeKey && (
              <Badge variant="outline" className="text-[9px] text-yellow-600 border-yellow-400">
                Gere uma API Key na aba "API Keys" primeiro
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Response format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px]">Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-green-600 mb-1">✓ Sucesso (201)</p>
              <CodeBlock code={`{ "success": true, "contact_id": "uuid", "deal_id": "uuid ou null" }`} id="resp-ok" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-red-500 mb-1">✗ Erro (400/401)</p>
              <CodeBlock code={`{ "error": "mensagem de erro" }`} id="resp-err" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fields reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            Campos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px]">Campo</TableHead>
                  <TableHead className="text-[9px]">Tipo</TableHead>
                  <TableHead className="text-[9px]">Obrigatório</TableHead>
                  <TableHead className="text-[9px]">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell className="font-mono text-[9px]">{f.name}</TableCell>
                    <TableCell className="text-[9px] text-muted-foreground">{f.type}</TableCell>
                    <TableCell className="text-[9px]">
                      {f.req ? <Badge variant="destructive" className="text-[8px]">sim</Badge> : <span className="text-muted-foreground">não</span>}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground">{f.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Code examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Code className="h-3.5 w-3.5" />
            Exemplos de Integração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold mb-2">1. cURL (terminal / backend)</p>
            <CodeBlock code={curlExample} id="curl" />
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-2">2. JavaScript (fetch) — direto no browser</p>
            <CodeBlock code={fetchExample} id="fetch" />
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-2">3. Formulário HTML completo pronto para copiar</p>
            <CodeBlock code={htmlFormExample} id="html" />
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-2">4. PHP</p>
            <CodeBlock code={phpExample} id="php" />
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-2">5. Criar lead + negócio em um único request</p>
            {pipelines.length === 0 && (
              <p className="text-[9px] text-yellow-600 mb-1">⚠ Crie um pipeline primeiro para usar pipeline_id</p>
            )}
            <CodeBlock code={withPipelineExample} id="pipeline" />
          </div>
        </CardContent>
      </Card>

      {/* Pipelines helper */}
      {pipelines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px]">IDs dos Seus Pipelines</CardTitle>
            <CardDescription className="text-[10px]">Use estes IDs no campo pipeline_id</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelines.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium w-32 truncate">{p.name}</span>
                  <code className="text-[9px] font-mono text-muted-foreground flex-1 truncate">{p.id}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copy(p.id, `pipe-${p.id}`)}>
                    {copiedId === `pipe-${p.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook integration note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] flex items-center gap-2">
            <Webhook className="h-3.5 w-3.5" />
            Receba notificações quando um lead chegar
          </CardTitle>
          <CardDescription className="text-[10px]">
            Configure webhooks de saída na aba "Webhooks" para receber uma chamada HTTP sempre que um lead for captado.
            Eventos disponíveis: <code className="bg-muted px-1 rounded">contact.created</code> e <code className="bg-muted px-1 rounded">deal.created</code>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ── Tracking Tab ──
function TrackingTab({ orgId }: { orgId: string | null }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const trackingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tracking`;
  const snippet = `<!-- VIONEX Tracking -->
<script>
(function() {
  var ORG_ID = "${orgId || 'SEU_ORG_ID'}";
  var ENDPOINT = "${trackingUrl}";
  var vid = localStorage.getItem("fc_vid") || (function() {
    var id = "v_" + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
    localStorage.setItem("fc_vid", id);
    return id;
  })();

  function track(eventType, extra) {
    var payload = {
      org_id: ORG_ID,
      visitor_id: vid,
      event_type: eventType || "pageview",
      page_url: location.href,
      page_title: document.title,
      referrer: document.referrer,
      metadata: extra || {}
    };
    navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
  }

  // Track pageview on load
  track("pageview");

  // Track navigation (SPA support)
  var oldPush = history.pushState;
  history.pushState = function() {
    oldPush.apply(this, arguments);
    setTimeout(function() { track("pageview"); }, 100);
  };

  // Expose for custom events
  window.VIONEX = {
    track: track,
    identify: function(email) {
      vid = email;
      localStorage.setItem("fc_vid", email);
      track("identify", { email: email });
    }
  };
})();
</script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast({ title: "Snippet copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Rastreamento de Website
          </CardTitle>
          <CardDescription className="text-[10px]">
            Adicione este snippet ao seu site para rastrear visitantes e aumentar o lead score automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <pre className="rounded-md bg-muted p-4 text-[9px] font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
              {snippet}
            </pre>
            <Button
              variant="outline" size="sm"
              className="absolute top-2 right-2 h-7 text-[9px]"
              onClick={copySnippet}
            >
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium">Como funciona:</p>
            <ul className="text-[10px] text-muted-foreground space-y-1">
              <li>• <strong>Pageviews</strong> são registrados automaticamente como atividades</li>
              <li>• <strong>Identificação</strong>: chame <code className="bg-muted px-1 rounded">VIONEX.identify("email@exemplo.com")</code> após formulários</li>
              <li>• <strong>Eventos customizados</strong>: <code className="bg-muted px-1 rounded">{'VIONEX.track("demo_request", {"plan": "pro"})'}</code></li>
              <li>• <strong>Lead Score</strong>: +1 ponto por pageview, +5 por identify, +10 por evento customizado</li>
              <li>• Suporte a SPA (intercepta <code className="bg-muted px-1 rounded">history.pushState</code>)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Import/Export Tab ──
function ImportExportTab({ orgId, userId }: { orgId: string | null; userId?: string }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportEntity = async (entity: string) => {
    if (!orgId) return;
    setExporting(entity);
    try {
      const { data, error } = await supabase.from(entity as any).select("*").eq("org_id", orgId);
      if (error) throw error;
      if (!data || data.length === 0) { toast({ title: "Sem dados para exportar" }); return; }

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(","),
        ...data.map((row: any) => headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${data.length} registros exportados` });
    } catch (e: any) {
      toast({ title: "Erro na exportação", description: e.message, variant: "destructive" });
    }
    setExporting(null);
  };

  const entities = [
    { key: "contacts", label: "Contatos", icon: "👤" },
    { key: "companies", label: "Empresas", icon: "🏢" },
    { key: "deals", label: "Negócios", icon: "💼" },
    { key: "activities", label: "Atividades", icon: "📋" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Exportar Dados</CardTitle>
          <CardDescription className="text-[10px]">
            Exporte qualquer entidade como arquivo CSV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {entities.map((ent) => (
              <Button
                key={ent.key}
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => exportEntity(ent.key)}
                disabled={exporting === ent.key}
              >
                {exporting === ent.key ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="text-lg">{ent.icon}</span>
                )}
                <span className="text-[10px]">{ent.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Importar Dados</CardTitle>
          <CardDescription className="text-[10px]">
            Importe contatos e empresas via CSV. Acesse a lista de contatos ou empresas e use o botão "Importar CSV".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-[10px] font-medium">Formatos suportados:</p>
            <ul className="text-[9px] text-muted-foreground space-y-1">
              <li>• <strong>CSV genérico</strong> — mapeamento de colunas manual</li>
              <li>• <strong>HubSpot Export</strong> — detecta automaticamente colunas "First Name", "Last Name", "Email"</li>
              <li>• <strong>Pipedrive Export</strong> — detecta "Person - Name", "Organization - Name"</li>
            </ul>
            <p className="text-[9px] text-muted-foreground mt-2">
              A importação inclui preview, mapeamento e detecção de duplicatas por email.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
