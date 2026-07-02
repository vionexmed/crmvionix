import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLeads } from "@/hooks/queries/useContacts";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { contactsKeys } from "@/hooks/queries/useContacts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  UserPlus, Phone, Building2, FileText, Zap, Trash2, CheckCircle2,
  Clock, Globe, RefreshCw, Eye, XCircle, MessageCircle, Calendar,
  Briefcase, AlignLeft,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  metadata: Record<string, string> | null;
  companies: { name: string } | null;
};

const sourceLabel = (src: string) => {
  const map: Record<string, string> = {
    site_vionex: "Site Vionex",
    landing_page: "Landing Page",
    google_forms_vionex: "Google Forms",
    landing_page_teste: "Teste",
  };
  return map[src] || src || "—";
};

export default function Leads() {
  const { orgId } = useOrg();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: leads = [], isLoading: loading, refetch } = useLeads();
  const { data: pipelines = [] } = usePipelines();

  const [viewing, setViewing] = useState<Lead | null>(null);
  const [qualifying, setQualifying] = useState<Lead | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState("");

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelines[0].id);
    }
  }, [pipelines, selectedPipeline]);

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      toast({ title: "Lead removido" });
      if (viewing?.id === id) setViewing(null);
      if (orgId) qc.invalidateQueries({ queryKey: contactsKeys.all(orgId) });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover lead", description: e.message, variant: "destructive" });
    },
  });

  const disqualifyMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const { error } = await supabase.from("contacts").update({ status: "churned" }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lead desqualificado" });
      setViewing(null);
      if (orgId) qc.invalidateQueries({ queryKey: contactsKeys.all(orgId) });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao desqualificar", description: e.message, variant: "destructive" });
    },
  });

  const qualifyMutation = useMutation({
    mutationFn: async ({ lead, pipelineId }: { lead: Lead; pipelineId: string }) => {
      if (!orgId) throw new Error("No org");
      // RPC atômica: status → prospect + criação do negócio na mesma transação
      const { error } = await supabase.rpc("qualify_lead", {
        p_contact_id: lead.id,
        p_pipeline_id: pipelineId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lead qualificado!", description: "Movido para Contatos e negócio criado." });
      setQualifying(null);
      // Invalida TODAS as queries de contatos (lista de leads E lista de contatos)
      if (orgId) qc.invalidateQueries({ queryKey: contactsKeys.all(orgId) });
      qc.invalidateQueries({ queryKey: ["deals"] });
      navigate("/deals");
    },
    onError: (e: any) => {
      toast({ title: "Erro ao qualificar", description: e.message, variant: "destructive" });
    },
  });

  const deleteLead = (id: string) => deleteLeadMutation.mutate(id);
  const disqualify = (lead: Lead) => disqualifyMutation.mutate(lead);

  const openQualify = (lead: Lead) => {
    setViewing(null);
    setQualifying(lead);
    if (!selectedPipeline && pipelines.length > 0) {
      setSelectedPipeline(pipelines[0].id);
    }
  };

  const qualify = () => {
    if (!qualifying || !selectedPipeline) return;
    qualifyMutation.mutate({ lead: qualifying, pipelineId: selectedPipeline });
  };

  const fullName = (lead: Lead) =>
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Sem nome";

  const meta = (lead: Lead, key: string) =>
    (lead.metadata as any)?.[key] || "";

  const whatsappLink = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean.startsWith("55") ? clean : "55" + clean}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={UserPlus}
        kicker="Captação"
        title="Leads"
        description={`${leads.length} lead${leads.length !== 1 ? "s" : ""} aguardando qualificação`}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Atualizar
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Carregando leads...
        </div>
      ) : leads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-heading font-semibold text-base">Nenhum lead ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando alguém preencher o formulário em vionex.med.br, o lead aparece aqui automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-[2fr_1.4fr_1.4fr_2fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Nome</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />Telefone</span>
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />Empresa</span>
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />Necessidade</span>
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Origem</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Recebido</span>
            <span>Ações</span>
          </div>

          {leads.map((lead, i) => (
            <div
              key={lead.id}
              className={`grid grid-cols-[2fr_1.4fr_1.4fr_2fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {(lead.first_name || "?").charAt(0).toUpperCase()}
                </div>
                <span className="font-medium truncate">{fullName(lead as Lead)}</span>
              </div>
              <span className="text-muted-foreground font-mono text-xs">{lead.phone || "—"}</span>
              <span className="text-muted-foreground truncate">{(lead.companies as any)?.name || meta(lead as Lead, "company") || "—"}</span>
              <span className="text-muted-foreground text-xs truncate" title={meta(lead as Lead, "notes")}>{meta(lead as Lead, "notes") || "—"}</span>
              <Badge variant="outline" className="text-[10px] font-medium w-fit">{sourceLabel(meta(lead as Lead, "source"))}</Badge>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(lead.created_at), { locale: ptBR, addSuffix: true })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="outline" className="h-7 w-7" title="Ver detalhes" onClick={() => setViewing(lead as Lead)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="default" className="h-7 text-[11px] px-2.5" onClick={() => openQualify(lead as Lead)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Qualificar
                </Button>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteLead(lead.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lead Detail Sheet ── */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
                    {(viewing.first_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="font-heading text-lg">{fullName(viewing)}</SheetTitle>
                    <Badge variant="outline" className="text-[10px] mt-1">Lead</Badge>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4 mt-2">
                {/* Info cards */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-md border border-border p-3">
                    <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Telefone / WhatsApp</p>
                      {viewing.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{viewing.phone}</span>
                          <a
                            href={whatsappLink(viewing.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-green-600 hover:underline"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Não informado</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-border p-3">
                    <Briefcase className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Especialidade / Empresa</p>
                      <span className="text-sm">{(viewing.companies as any)?.name || meta(viewing, "company") || "Não informado"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-border p-3">
                    <AlignLeft className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Volume / Necessidade</p>
                      <span className="text-sm leading-relaxed">{meta(viewing, "notes") || "Não informado"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 rounded-md border border-border p-3">
                      <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Origem</p>
                        <span className="text-sm">{sourceLabel(meta(viewing, "source"))}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-md border border-border p-3">
                      <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Recebido em</p>
                        <span className="text-sm">{format(new Date(viewing.created_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</p>
                  <Button className="w-full" onClick={() => openQualify(viewing)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Qualificar → criar negócio
                  </Button>
                  <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-destructive/5" onClick={() => disqualify(viewing)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Desqualificar
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => deleteLead(viewing.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir lead
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Qualify Modal ── */}
      <Dialog open={!!qualifying} onOpenChange={(o) => !o && setQualifying(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Qualificar Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{qualifying && fullName(qualifying)}</p>
              {qualifying?.phone && (
                <p className="text-muted-foreground text-xs mt-0.5">{qualifying.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Adicionar ao pipeline
              </label>
              {pipelines.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum pipeline encontrado. Crie um em Negócios primeiro.
                </p>
              ) : (
                <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              O lead vira <strong>Prospect</strong> em Contatos e um negócio é criado no primeiro estágio do pipeline selecionado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualifying(null)}>Cancelar</Button>
            <Button onClick={qualify} disabled={qualifyMutation.isPending || !selectedPipeline}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {qualifyMutation.isPending ? "Qualificando..." : "Qualificar e criar negócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
