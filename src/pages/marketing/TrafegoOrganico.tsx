
import { Search, Globe, Instagram, Linkedin } from "lucide-react";

const channels = [
  { nome: "Google Orgânico", icon: Search, sessoes: 28400, leads: 98, cvr: 0.35, color: "#0A6640" },
  { nome: "Direto", icon: Globe, sessoes: 9800, leads: 22, cvr: 0.22, color: "#9AA3B0" },
  { nome: "Instagram orgânico", icon: Instagram, sessoes: 4200, leads: 18, cvr: 0.43, color: "#E1306C" },
  { nome: "LinkedIn orgânico", icon: Linkedin, sessoes: 2100, leads: 14, cvr: 0.67, color: "#0A66C2" },
];

const topPages = [
  { url: "/blog/crm-clinica-medica", views: 8420, ctr: 4.2 },
  { url: "/blog/gestao-pacientes", views: 6180, ctr: 3.8 },
  { url: "/blog/automacao-consultorio", views: 4920, ctr: 2.9 },
  { url: "/recursos/integracao-prontuario", views: 3680, ctr: 5.1 },
  { url: "/blog/marketing-medico", views: 2840, ctr: 2.1 },
];

const keywords = [
  { termo: "crm para clínica médica", pos: 3, vol: 1200, clicks: 218 },
  { termo: "sistema gestão de pacientes", pos: 5, vol: 2400, clicks: 184 },
  { termo: "software para consultório", pos: 8, vol: 3800, clicks: 142 },
  { termo: "agenda médica online", pos: 12, vol: 5600, clicks: 98 },
  { termo: "marketing para médicos", pos: 6, vol: 1800, clicks: 86 },
];

export default function TrafegoOrganico() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="text-xs text-muted-foreground">Marketing › Tráfego › Orgânico</div>
        <h1 className="text-2xl font-semibold tracking-tight">Tráfego orgânico — SEO & Social</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {channels.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.nome} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3.5 w-3.5" style={{ color: c.color }} /> {c.nome}
              </div>
              <div className="text-xl font-semibold tabular-nums mt-2">{c.sessoes.toLocaleString("pt-BR")}</div>
              <div className="text-[11px] text-muted-foreground">{c.leads} leads · CVR {c.cvr}%</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top páginas orgânicas</h3>
          <div className="space-y-2 text-xs">
            {topPages.map(p => (
              <div key={p.url} className="flex items-center justify-between py-2 border-b last:border-0">
                <code className="text-muted-foreground">{p.url}</code>
                <div className="flex gap-4 tabular-nums">
                  <span>{p.views.toLocaleString("pt-BR")} views</span>
                  <span className="text-emerald-600 w-12 text-right">{p.ctr}% CTR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Palavras-chave orgânicas</h3>
          <div className="space-y-2 text-xs">
            {keywords.map(k => (
              <div key={k.termo} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div>{k.termo}</div>
                  <div className="text-[10px] text-muted-foreground">vol {k.vol.toLocaleString("pt-BR")}/mês</div>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted">pos #{k.pos}</span>
                  <span className="tabular-nums w-16 text-right">{k.clicks} clicks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-xs text-amber-900">
        ⚠ Dados de exemplo. Conecte o Google Analytics 4 e o Google Search Console para puxar métricas reais.
      </div>
    </div>
  );
}
