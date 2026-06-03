import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";
import { ESPECIALIDADE_OPTIONS } from "@/components/crm/likawave-options";
import type { Database } from "@/integrations/supabase/types";

type Company = Database["public"]["Tables"]["companies"]["Row"];

interface ContactCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  companies: Company[];
}

export function ContactCreateModal({ open, onOpenChange, onCreated, companies }: ContactCreateModalProps) {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [especialidade, setEspecialidade] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [companyId, setCompanyId] = useState("none");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setFullName(""); setEmail(""); setPhone(""); setPhoneValid(false);
    setEspecialidade(""); setLocal(""); setDescricao(""); setCompanyId("none"); setErrors({});
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Nome é obrigatório";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    if (phone && !phoneValid) errs.phone = "Telefone inválido (inclua DDI + DDD)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!orgId || !validate()) return;
    setSaving(true);

    const [first, ...rest] = fullName.trim().split(/\s+/);
    const last = rest.join(" ") || null;

    const { error } = await supabase.from("contacts").insert({
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: email || null,
      phone: phone || null,
      title: especialidade || null,
      status: "lead",
      owner_id: user?.id,
      company_id: companyId !== "none" ? companyId : null,
      metadata: {
        cidade_estado: local,
        especialidade_medica: especialidade,
        descricao,
        responsavel_cadastro: user?.email || "",
      } as never,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar contato", description: error.message, variant: "destructive" });
      return;
    }
    onOpenChange(false);
    onCreated();
    toast({ title: "Contato criado com sucesso" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
          <DialogDescription>Preencha os dados principais do contato</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label>Nome completo <span className="text-destructive">*</span></Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Ana Beatriz Costa"
              autoFocus
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <PhoneInput
              value={phone}
              onChange={(e164, valid) => { setPhone(e164); setPhoneValid(valid); }}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Especialidade */}
          <div className="space-y-1.5">
            <Label>Especialidade</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione ou deixe em branco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Nenhuma —</SelectItem>
                {ESPECIALIDADE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Local */}
          <div className="space-y-1.5">
            <Label>Cidade / Estado</Label>
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: São Paulo / SP"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Informações adicionais sobre o contato..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Empresa (somente se houver empresas cadastradas) */}
          {companies.length > 0 && (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleCreate} className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Criar Contato"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
