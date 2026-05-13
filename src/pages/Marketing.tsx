import { useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Megaphone, RefreshCw, TrendingUp, MousePointerClick, Eye, DollarSign,
  Target, BarChart3, Loader2,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { CreateCampaignModal } from "@/components/marketing/CreateCampaignModal";

function formatCurrency(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v || 0);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
}

function MarketingHeader({ active }: { active: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "full" },
      });
      if (error) throw error;
      toast.success(`Sincronizado: ${data?.records_synced || 0} registros`);
      qc.invalidateQueries({ queryKey: ["meta"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border-b border-border bg-card">
      <div className="px-6 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Marketing</h1>
            <p className="text-sm text-muted-foreground">Gestão de campanhas Meta Ads</p>
          </div>
        </div>
        <Button onClick={sync} disabled={syncing} variant="outline" size="sm">
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar
        </Button>
      </div>
      <div className="px-6">
        <Tabs value={active} onValueChange={(v) => navigate(v === "overview" ? "/marketing" : `/marketing/${v}`)}>
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 pb-2">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-transparent data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 pb-2">
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-transparent data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 pb-2">
              Insights
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function Overview() {
  const { data: insights = [], isLoading } = useQuery({
    queryKey: ["meta", "insights", "overview"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("meta_insights")
        .select("*")
        .gte("date_start", since.toISOString().slice(0, 10))
        .order("date_start", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const totals = insights.reduce(
    (acc, r: any) => ({
      spend: acc.spend + Number(r.spend || 0),
      impressions: acc.impressions + Number(r.impressions || 0),
      clicks: acc.clicks + Number(r.clicks || 0),
      conversions: acc.conversions + Number(r.conversions || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks ? totals.spend / totals.clicks : 0;

  // group by date
  const daily: Record<string, { date: string; spend: number; conversions: number }> = {};
  insights.forEach((r: any) => {
    if (!daily[r.date_start]) daily[r.date_start] = { date: r.date_start, spend: 0, conversions: 0 };
    daily[r.date_start].spend += Number(r.spend || 0);
    daily[r.date_start].conversions += Number(r.conversions || 0);
  });
  const chartData = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Gasto (30d)" value={formatCurrency(totals.spend)} icon={DollarSign} />
        <KpiCard label="Impressões" value={formatNumber(totals.impressions)} icon={Eye} />
        <KpiCard label="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
        <KpiCard label="CTR" value={`${ctr.toFixed(2)}%`} icon={TrendingUp} />
        <KpiCard label="CPC médio" value={formatCurrency(cpc)} icon={Target} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gasto x Conversões — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum dado ainda. Clique em "Sincronizar" para buscar do Meta Ads.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value: any, name: any) => [name === "spend" ? formatCurrency(Number(value)) : value, name === "spend" ? "Gasto" : "Conversões"]}
                />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="hsl(var(--chart-2, var(--primary)))" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Campaigns() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["meta", "campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("*, meta_ad_accounts(name, currency)")
        .order("updated_time", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: insightsByCamp = {} } = useQuery({
    queryKey: ["meta", "insights", "byCampaign"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("meta_insights")
        .select("campaign_id, spend, impressions, clicks, conversions")
        .gte("date_start", since.toISOString().slice(0, 10));
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => {
        if (!r.campaign_id) return;
        if (!map[r.campaign_id]) map[r.campaign_id] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        map[r.campaign_id].spend += Number(r.spend || 0);
        map[r.campaign_id].impressions += Number(r.impressions || 0);
        map[r.campaign_id].clicks += Number(r.clicks || 0);
        map[r.campaign_id].conversions += Number(r.conversions || 0);
      });
      return map;
    },
  });

  const toggleStatus = async (camp: any) => {
    const newStatus = camp.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const { error } = await supabase.functions.invoke("meta-ads-mutate", {
        body: { action: "update_status", meta_campaign_id: camp.meta_campaign_id, payload: { status: newStatus } },
      });
      if (error) throw error;
      toast.success(`Campanha ${newStatus === "ACTIVE" ? "ativada" : "pausada"}`);
      qc.invalidateQueries({ queryKey: ["meta", "campaigns"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">{campaigns.length} campanhas</div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Megaphone className="h-4 w-4 mr-2" />Nova campanha
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Gasto (30d)</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma campanha. Sincronize com o Meta Ads.</TableCell></TableRow>
            ) : campaigns.map((c: any) => {
              const ins = insightsByCamp[c.id] || { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
              const ctr = ins.impressions ? (ins.clicks / ins.impressions) * 100 : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => toggleStatus(c)} />
                      <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                        {c.effective_status || c.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{c.objective || "—"}</span></TableCell>
                  <TableCell><span className="text-xs">{c.meta_ad_accounts?.name || "—"}</span></TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(ins.spend, c.meta_ad_accounts?.currency)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(ins.clicks)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(ins.conversions)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <CreateCampaignModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Insights() {
  const { data: insights = [] } = useQuery({
    queryKey: ["meta", "insights", "all"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("meta_insights")
        .select("*, meta_campaigns(name)")
        .gte("date_start", since.toISOString().slice(0, 10))
        .order("date_start", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const byCampaign: Record<string, { name: string; spend: number; conversions: number }> = {};
  insights.forEach((r: any) => {
    const name = r.meta_campaigns?.name || r.entity_id;
    if (!byCampaign[name]) byCampaign[name] = { name, spend: 0, conversions: 0 };
    byCampaign[name].spend += Number(r.spend || 0);
    byCampaign[name].conversions += Number(r.conversions || 0);
  });
  const chartData = Object.values(byCampaign).sort((a, b) => b.spend - a.spend).slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 campanhas por gasto (30d)</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any) => formatCurrency(Number(v))}
                />
                <Bar dataKey="spend" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Marketing() {
  return (
    <div className="flex flex-col h-full">
      <Routes>
        <Route index element={<><MarketingHeader active="overview" /><Overview /></>} />
        <Route path="campaigns" element={<><MarketingHeader active="campaigns" /><Campaigns /></>} />
        <Route path="insights" element={<><MarketingHeader active="insights" /><Insights /></>} />
      </Routes>
    </div>
  );
}
