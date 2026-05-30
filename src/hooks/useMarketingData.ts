import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { periodDays, type PeriodKey, type Campaign } from "@/lib/marketingMockData";

export type MarketingSource = "real";

export interface MarketingPayload {
  meta: { campaigns: Campaign[]; source: MarketingSource };
  google: { campaigns: Campaign[]; source: MarketingSource };
  loading: boolean;
  updatedAt: Date;
}

/**
 * Busca dados reais de Meta Ads do Supabase. Sem mock:
 * quando não há dados, retorna arrays vazios (UI mostra zeros).
 * Google Ads ainda não tem backend → array vazio até integrar.
 */
export function useMarketingData(period: PeriodKey, customDays = 30): MarketingPayload {
  const { orgId } = useOrg();
  const [state, setState] = useState<MarketingPayload>({
    meta: { campaigns: [], source: "real" },
    google: { campaigns: [], source: "real" },
    loading: false,
    updatedAt: new Date(),
  });

  useEffect(() => {
    const days = periodDays(period, customDays);

    setState((s) => ({
      ...s,
      meta: { campaigns: [], source: "real" },
      google: { campaigns: [], source: "real" },
      updatedAt: new Date(),
    }));

    if (!orgId) return;

    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const { data: campRows } = await supabase
          .from("meta_campaigns")
          .select("id, meta_campaign_id, name, status, daily_budget")
          .eq("org_id", orgId);

        if (!campRows?.length) {
          if (!cancelled) setState((s) => ({ ...s, loading: false, updatedAt: new Date() }));
          return;
        }

        const { data: insights } = await supabase
          .from("meta_insights")
          .select("campaign_id, spend, impressions, clicks, conversions, reach")
          .eq("org_id", orgId)
          .eq("level", "campaign")
          .gte("date_start", sinceStr);

        const agg = new Map<string, { spend: number; imp: number; clicks: number; conv: number; reach: number }>();
        (insights || []).forEach((r: any) => {
          const k = r.campaign_id;
          if (!k) return;
          const cur = agg.get(k) || { spend: 0, imp: 0, clicks: 0, conv: 0, reach: 0 };
          cur.spend += Number(r.spend || 0);
          cur.imp += Number(r.impressions || 0);
          cur.clicks += Number(r.clicks || 0);
          cur.conv += Number(r.conversions || 0);
          cur.reach += Number(r.reach || 0);
          agg.set(k, cur);
        });

        const mapped: Campaign[] = campRows.map((c: any) => {
          const a = agg.get(c.id) || { spend: 0, imp: 0, clicks: 0, conv: 0, reach: 0 };
          const ctr = a.imp ? (a.clicks / a.imp) * 100 : 0;
          const cpc = a.clicks ? a.spend / a.clicks : 0;
          const cpm = a.imp ? (a.spend / a.imp) * 1000 : 0;
          const cpl = a.conv ? a.spend / a.conv : 0;
          const cvr = a.clicks ? (a.conv / a.clicks) * 100 : 0;
          return {
            id: c.id,
            nome: c.name || c.meta_campaign_id,
            plataforma: "meta" as const,
            tipo: "Meta Ads",
            status: (c.status?.toLowerCase().includes("paus")
              ? "pausado"
              : c.status?.toLowerCase().includes("learn")
              ? "aprendendo"
              : "ativo") as Campaign["status"],
            formato: "Meta",
            investido: Math.round(a.spend),
            impressoes: a.imp,
            alcance: a.reach,
            frequencia: a.reach ? a.imp / a.reach : 0,
            cpm,
            cliques: a.clicks,
            cpc,
            ctr,
            conversoes: a.conv,
            cvr,
            cpl,
            receita_atrib: 0, // sem atribuição de receita até integrar conversão de pipeline
            roas: 0,
          };
        });

        if (cancelled) return;
        setState((s) => ({
          ...s,
          meta: { campaigns: mapped, source: "real" },
          loading: false,
          updatedAt: new Date(),
        }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, period, customDays]);

  return state;
}
