// Estrutura zerada — os dados reais virão das integrações (Meta Ads, Google Ads, GA4).
// Mantemos os exports para compatibilidade com a UI; valores começam em zero.

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtNum = (n: number) => n.toLocaleString("pt-BR");
export const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export type Campaign = {
  id: string;
  nome: string;
  plataforma: "meta" | "google";
  tipo: string;
  status: "ativo" | "pausado" | "aprendendo";
  formato: string;
  investido: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  cpm: number;
  cliques: number;
  cpc: number;
  ctr: number;
  conversoes: number;
  cvr: number;
  cpl: number;
  receita_atrib: number;
  roas: number;
  impression_share?: number;
  is_perdido_orcamento?: number;
  is_perdido_rank?: number;
  quality_score?: number;
};

// Sem dados — esperando integração com as plataformas.
export const metaCampaigns: Campaign[] = [];
export const googleCampaigns: Campaign[] = [];

export const sumBy = <T,>(arr: T[], key: keyof T) =>
  arr.reduce((acc, x) => acc + Number(x[key] || 0), 0);

// Origens de leads — começam zeradas; serão preenchidas via tracking/UTM.
export const leadSources = [
  { name: "Meta Ads", color: "#1877F2", count: 0, pct: 0 },
  { name: "Google Ads", color: "#EA4335", count: 0, pct: 0 },
  { name: "Orgânico / SEO", color: "#0A6640", count: 0, pct: 0 },
  { name: "Email", color: "#007B8A", count: 0, pct: 0 },
  { name: "Indicação", color: "#5B21B6", count: 0, pct: 0 },
  { name: "Direto / Sem UTM", color: "#9AA3B0", count: 0, pct: 0 },
];

export const funnelData = [
  { num: "0", nome: "Visitantes únicos", desc: "Aguardando integração com GA4" },
  { num: "0", nome: "Leads captados", desc: "Sem leads no período" },
  { num: "0", nome: "MQLs qualificados", desc: "Lead scoring ≥ 70" },
  { num: "0", nome: "SQLs em negociação", desc: "Em pipeline ativo" },
  { num: "0", nome: "Clientes fechados", desc: "Negócios ganhos no período" },
];

export const publicos: { nome: string; cpl: number; max: number }[] = [];
export const criativos: { nome: string; formato: string; ctr: number; cpl: number }[] = [];
export const demografico: { faixa: string; pct: number }[] = [
  { faixa: "18–24", pct: 0 },
  { faixa: "25–34", pct: 0 },
  { faixa: "35–44", pct: 0 },
  { faixa: "45–54", pct: 0 },
  { faixa: "55+", pct: 0 },
];
export const keywords: { termo: string; match: string; impressoes: number; ctr: number; cpc: number; conv: number }[] = [];

/** Série diária zerada (últimos 30 dias por padrão). */
function zeroSeries(days = 30) {
  return Array.from({ length: days }, (_, i) => ({ day: `D${i + 1}`, value: 0 }));
}

export const dailyInvest = zeroSeries(90);
export const dailyRevenue = zeroSeries(90);
export const dailyLeads = zeroSeries(90);
export const dailyMeta = zeroSeries(90);
export const dailyGoogle = zeroSeries(90);

export const dailyChannelsCompare = dailyMeta.map((m, i) => ({
  day: m.day,
  Meta: 0,
  Google: 0,
}));

/* ============================================================
   PERIOD HELPERS
   ============================================================ */

export type PeriodKey = "7d" | "30d" | "90d" | "custom";

export const periodFactor = (key: PeriodKey, customDays = 30) => {
  if (key === "7d") return 7 / 30;
  if (key === "90d") return 90 / 30;
  if (key === "custom") return Math.max(1, customDays) / 30;
  return 1;
};

export const periodDays = (key: PeriodKey, customDays = 30) =>
  key === "7d" ? 7 : key === "90d" ? 90 : key === "custom" ? customDays : 30;

export function scaleCampaigns<T extends Campaign>(rows: T[], _factor: number): T[] {
  // Sem mock: retornamos as campanhas reais sem alterar.
  return rows;
}

export function sliceSeries<T extends { day: string; value?: number }>(
  series: T[],
  days: number,
): T[] {
  const max = Math.min(days, series.length);
  const start = Math.max(0, series.length - max);
  return series.slice(start).map((d, i) => ({ ...d, day: `D${i + 1}` }));
}

export function sliceCompareSeries(
  series: { day: string; Meta: number; Google: number }[],
  days: number,
) {
  const max = Math.min(days, series.length);
  const start = Math.max(0, series.length - max);
  return series.slice(start).map((d, i) => ({ ...d, day: `D${i + 1}` }));
}

/** Distribui um total em N dias (igual para todos — sem ruído mockado). */
export function seriesFromTotal(total: number, days: number, _seedN = 7) {
  const base = days > 0 ? total / days : 0;
  return Array.from({ length: days }, (_, i) => ({
    day: `D${i + 1}`,
    value: Math.round(base),
  }));
}
