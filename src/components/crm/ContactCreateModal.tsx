import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput, isValidPhone } from "@/components/ui/phone-input";
import {
  ESPECIALIDADE_OPTIONS, LOCAL_ATUACAO_OPTIONS, EQUIPAMENTO_OPTIONS,
  NIVEL_INTERESSE_OPTIONS, TRATAMENTOS_OPTIONS, PACIENTES_MES_OPTIONS,
  AGENDAMENTO_OPTIONS, AUTORIZACAO_OPTIONS, CLASSIFICACAO_LEAD_OPTIONS,
  type LikawaveMetadata,
} from "@/components/crm/likawave-options";
import type { Database } from "@/integrations/supabase/types";

type Company = Database["public"]["Tables"]["companies"]["Row"];

interface ContactCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  companies: Company[];
}

const OUTRO = "__outro__";

const initialMeta: LikawaveMetadata = {
  instagram: "", cidade_estado: "", especialidade_medica: "", especialidade_outro: "",
  crm_crefito: "", local_atuacao: "", local_atuacao_outro: "", usa_ondas_choque: "",
  equipamento_atual: "", equipamento_outro: "", nivel_interesse: "", nivel_interesse_outro: "",
  tratamentos_pretendidos: [], tratamentos_outro: "", pacientes_mes: "",
  agendamento_demo: [], agendamento_outro: "", autorizacao_contato: "",
  classificacao_lead: "", responsavel_cadastro: "",
};

export function ContactCreateModal({ open, onOpenChange, onCreated, companies }: ContactCreateModalProps) {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [meta, setMeta] = useState<LikawaveMetadata>(initialMeta);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill responsible user with logged user
  useEffect(() => {
    if (open && user) {
      setMeta((m) => ({ ...m, responsavel_cadastro: m.responsavel_cadastro || user.email || "" }));
    }
  }, [open, user]);

  const reset = () => {
    setFullName(""); setEmail(""); setPhone(""); setPhoneValid(false);
    setMeta({ ...initialMeta, responsavel_cadastro: user?.email || "" });
    setErrors({});
  };

  const toggleMulti = (key: "tratamentos_pretendidos" | "agendamento_demo", value: string) => {
    setMeta((m) => {
      const current = m[key] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...m, [key]: next };
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Nome completo é obrigatório";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    if (phone && !phoneValid) errs.phone = "Telefone deve incluir DDI + DDD + número (ex.: +55 81 99999-0000)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!orgId || !validate()) return;
    setSaving(true);
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const last = rest.join(" ") || null;

    // Resolve "Outro" overrides into final metadata values
    const finalMeta: LikawaveMetadata = { ...meta };
    if (finalMeta.especialidade_medica === OUTRO) finalMeta.especialidade_medica = finalMeta.especialidade_outro || "";
    if (finalMeta.local_atuacao === OUTRO) finalMeta.local_atuacao = finalMeta.local_atuacao_outro || "";
    if (finalMeta.equipamento_atual === OUTRO) finalMeta.equipamento_atual = finalMeta.equipamento_outro || "";
    if (finalMeta.nivel_interesse === OUTRO) finalMeta.nivel_interesse = finalMeta.nivel_interesse_outro || "";

    const { error } = await supabase.from("contacts").insert({
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: email || null,
      phone: phone || null,
      status: "lead",
      owner_id: user?.id,
      metadata: finalMeta as never,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    onOpenChange(false);
    reset();
    onCreated();
    toast({ title: "Contato criado" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro Likawave</DialogTitle>
          <DialogDescription>Captação de Leads — preencha os dados do novo contato</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Nome completo */}
          <Field label="Nome completo *" error={errors.fullName}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="João da Silva" />
          </Field>

          {/* Email */}
          <Field label="Email" error={errors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />
          </Field>

          {/* Telefone */}
          <Field label="Telefone (DDI + DDD + número)" error={errors.phone}>
            <PhoneInput
              value={phone}
              onChange={(e164, valid) => { setPhone(e164); setPhoneValid(valid); }}
            />
          </Field>

          {/* Instagram */}
          <Field label="Instagram Profissional (opcional)">
            <Input value={meta.instagram} onChange={(e) => setMeta({ ...meta, instagram: e.target.value })} placeholder="@seuperfil" />
          </Field>

          {/* Cidade/Estado */}
          <Field label="Cidade/Estado">
            <Input value={meta.cidade_estado} onChange={(e) => setMeta({ ...meta, cidade_estado: e.target.value })} placeholder="Recife/PE" />
          </Field>

          {/* Especialidade Médica */}
          <SelectWithOther
            label="Especialidade Médica"
            options={[...ESPECIALIDADE_OPTIONS]}
            value={meta.especialidade_medica || ""}
            otherValue={meta.especialidade_outro || ""}
            onValue={(v) => setMeta({ ...meta, especialidade_medica: v })}
            onOther={(v) => setMeta({ ...meta, especialidade_outro: v })}
          />

          {/* CRM / CREFITO */}
          <Field label="CRM / CREFITO (se aplicável)">
            <Input value={meta.crm_crefito} onChange={(e) => setMeta({ ...meta, crm_crefito: e.target.value })} />
          </Field>

          {/* Local de Atuação */}
          <SelectWithOther
            label="Local de Atuação"
            options={[...LOCAL_ATUACAO_OPTIONS]}
            value={meta.local_atuacao || ""}
            otherValue={meta.local_atuacao_outro || ""}
            onValue={(v) => setMeta({ ...meta, local_atuacao: v })}
            onOther={(v) => setMeta({ ...meta, local_atuacao_outro: v })}
          />

          {/* Já utiliza Ondas de Choque? */}
          <Field label="Já utiliza Ondas de Choque?">
            <RadioGroup
              value={meta.usa_ondas_choque || ""}
              onValueChange={(v) => setMeta({ ...meta, usa_ondas_choque: v as "Sim" | "Não" })}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="Sim" /> Sim
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="Não" /> Não
              </label>
            </RadioGroup>
          </Field>

          {/* Equipamento atual */}
          {meta.usa_ondas_choque === "Sim" && (
            <SelectWithOther
              label="Qual equipamento?"
              options={[...EQUIPAMENTO_OPTIONS]}
              value={meta.equipamento_atual || ""}
              otherValue={meta.equipamento_outro || ""}
              onValue={(v) => setMeta({ ...meta, equipamento_atual: v })}
              onOther={(v) => setMeta({ ...meta, equipamento_outro: v })}
            />
          )}

          {/* Nível de interesse */}
          <SelectWithOther
            label="Qual seu nível de interesse na tecnologia Likawave?"
            options={[...NIVEL_INTERESSE_OPTIONS]}
            value={meta.nivel_interesse || ""}
            otherValue={meta.nivel_interesse_outro || ""}
            onValue={(v) => setMeta({ ...meta, nivel_interesse: v })}
            onOther={(v) => setMeta({ ...meta, nivel_interesse_outro: v })}
          />

          {/* Tratamentos pretendidos */}
          <Field label="Quais tratamentos pretende realizar?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TRATAMENTOS_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={meta.tratamentos_pretendidos?.includes(opt) || false}
                    onCheckedChange={() => toggleMulti("tratamentos_pretendidos", opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <Input
              className="mt-2"
              placeholder="Outro (especifique)"
              value={meta.tratamentos_outro}
              onChange={(e) => setMeta({ ...meta, tratamentos_outro: e.target.value })}
            />
          </Field>

          {/* Pacientes/mês */}
          <Field label="Quantos pacientes com indicação para ondas de choque você atende por mês?">
            <Select value={meta.pacientes_mes || ""} onValueChange={(v) => setMeta({ ...meta, pacientes_mes: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PACIENTES_MES_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* Agendamento de demonstração */}
          <Field label="Agendamento de demonstração">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AGENDAMENTO_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={meta.agendamento_demo?.includes(opt) || false}
                    onCheckedChange={() => toggleMulti("agendamento_demo", opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <Input
              className="mt-2"
              placeholder="Outro (especifique)"
              value={meta.agendamento_outro}
              onChange={(e) => setMeta({ ...meta, agendamento_outro: e.target.value })}
            />
          </Field>

          {/* Autorização */}
          <Field label="Autorização">
            <RadioGroup
              value={meta.autorizacao_contato || ""}
              onValueChange={(v) => setMeta({ ...meta, autorizacao_contato: v })}
              className="space-y-2"
            >
              {AUTORIZACAO_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-start gap-2 text-sm">
                  <RadioGroupItem value={opt} className="mt-0.5" />
                  <span>{opt}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>

          {/* Classificação do Lead (uso interno) */}
          <Field label="Classificação do Lead (uso interno)">
            <RadioGroup
              value={meta.classificacao_lead || ""}
              onValueChange={(v) => setMeta({ ...meta, classificacao_lead: v })}
              className="space-y-2"
            >
              {CLASSIFICACAO_LEAD_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={opt} />
                  {opt}
                </label>
              ))}
            </RadioGroup>
          </Field>

          {/* Responsável pelo cadastro */}
          <Field label="Responsável pelo cadastro">
            <Input
              value={meta.responsavel_cadastro || ""}
              onChange={(e) => setMeta({ ...meta, responsavel_cadastro: e.target.value })}
              placeholder="Nome ou email do responsável"
            />
          </Field>

          {/* Empresa (opcional, mantém integração com módulo de empresas) */}
          {companies.length > 0 && (
            <Field label="Empresa (opcional)">
              <Select
                value={(meta as Record<string, string>).company_id || "none"}
                onValueChange={(v) => setMeta({ ...meta, ...(v === "none" ? { company_id: "" } : { company_id: v }) } as LikawaveMetadata)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Button onClick={handleCreate} className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Criar Contato"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectWithOther({
  label, options, value, otherValue, onValue, onOther,
}: {
  label: string;
  options: string[];
  value: string;
  otherValue: string;
  onValue: (v: string) => void;
  onOther: (v: string) => void;
}) {
  const isOther = value === OUTRO || (value && !options.includes(value));
  return (
    <Field label={label}>
      <Select value={isOther ? OUTRO : value} onValueChange={onValue}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          <SelectItem value={OUTRO}>Outro...</SelectItem>
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          className="mt-2"
          placeholder="Especifique"
          value={otherValue}
          onChange={(e) => onOther(e.target.value)}
        />
      )}
    </Field>
  );
}
