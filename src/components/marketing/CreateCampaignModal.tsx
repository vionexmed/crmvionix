import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: Array<{ id: string; name: string }>;
  onCreated: () => void;
}

export function CreateCampaignModal({ open, onOpenChange, accounts, onCreated }: Props) {
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!accountId || !name) {
      toast.error("Preencha conta e nome");
      return;
    }
    setLoading(true);
    const { error } = await supabase.functions.invoke("meta-ads-mutate", {
      body: { action: "create_campaign", ad_account_id: accountId, name, objective, daily_budget: budget ? Number(budget) : null },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar campanha: " + error.message);
      return;
    }
    toast.success("Campanha criada (PAUSED)");
    setName(""); setBudget("");
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Conta de Anúncios</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Campanha Outubro" />
          </div>
          <div>
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Orçamento Diário (R$)</Label>
            <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="50.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
