import { useState } from "react";
import { Mail, Plus, Inbox, Send, RefreshCw, Settings, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { useState as useLocalState } from "react";

const FEATURES = [
  { icon: Send,     title: "Campanhas",       desc: "Envie email marketing segmentado para seus leads e clientes." },
  { icon: Inbox,    title: "Respostas",       desc: "Receba e gerencie respostas de campanhas em um só lugar." },
  { icon: CheckCircle2, title: "Rastreamento", desc: "Acompanhe abertura e cliques em tempo real." },
];

export default function InboxMarketing() {
  const { orgId } = useOrg();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      const { data } = await supabase.functions.invoke("gmail-oauth-start", {
        body: { purpose: "marketing", label: "Email Marketing" },
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Erro ao iniciar conexão", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao conectar Gmail", variant: "destructive" });
    }
    setConnecting(false);
  };

  const handleSync = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      await supabase.functions.invoke("gmail-sync", { body: { purpose: "marketing" } });
      toast({ title: "Sincronização iniciada" });
    } catch {
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    }
    setConnecting(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Mail}
        kicker="Marketing"
        title="Email Marketing"
        description="Gerencie o email da sua empresa para campanhas de marketing"
        actions={
          connected ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="vx-badge vx-badge-customer gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {marketingEmail || "Conectado"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={connecting}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${connecting ? "animate-spin" : ""}`} />
                Sincronizar
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Configurar
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              <Plus className="mr-2 h-4 w-4" />
              {connecting ? "Conectando..." : "Conectar Gmail Marketing"}
            </Button>
          )
        }
      />

      {!connected ? (
        /* Setup state — email não conectado */
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Card principal de setup */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-0 shadow-md">
              <div className="h-1 bg-gradient-to-r from-primary to-[hsl(187_97%_36%)]" />
              <CardContent className="p-8 flex flex-col items-center text-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent ring-8 ring-accent/30">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Configure o Email Marketing</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                    Conecte uma conta Gmail dedicada para marketing — separada do seu email de atendimento.
                    Envie campanhas, acompanhe respostas e rastreie resultados.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={handleConnect} disabled={connecting} className="gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Conectar conta Google
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <a href="https://support.google.com/a/answer/176600" target="_blank" rel="noopener noreferrer" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Saiba mais
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use uma conta Gmail separada, ex.: <span className="font-mono">marketing@suaempresa.com</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cards de funcionalidades */}
          <div className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Connected state — mostra inbox */
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Inbox className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Nenhum email marketing encontrado.</p>
          <p className="text-xs mt-1">Clique em <strong>Sincronizar</strong> para buscar emails.</p>
        </div>
      )}
    </div>
  );
}
