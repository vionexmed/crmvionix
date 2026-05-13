import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CreateCampaignModal({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [accountId, setAccountId] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["meta", "accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_accounts")
        .select("id, meta_account_id, name, currency");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const submit = async () => {
    if (!name || !accountId) {
      toast.error("Preencha nome e conta");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("meta-ads-mutate", {
        body: {
          action: "create_campaign",
          meta_account_id: accountId,
          payload: {
            name,
            objective,
            status: "PAUSED",
            daily_budget: dailyBudget ? Number(dailyBudget) : undefined,
          },
        },
      });
      if (error) throw error;
      toast.success("Campanha criada (pausada). Sincronize para ver.");
      qc.invalidateQueries({ queryKey: ["meta"] });
      onOpenChange(false);
      setName("");
      setDailyBudget("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar campanha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black Friday 2025" />
          </div>
          <div className="space-y-2">
            <Label>Conta de anúncio</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.meta_account_id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma conta. Sincronize primeiro.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Orçamento diário (opcional)</Label>
            <Input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} placeholder="50.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
