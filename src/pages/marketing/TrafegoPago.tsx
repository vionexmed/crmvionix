
import { Facebook, Chrome } from "lucide-react";
import { metaCampaigns, googleCampaigns, sumBy, fmtBRL, fmtNum } from "@/lib/marketingMockData";

export default function TrafegoPago() {
  const totalMeta = sumBy(metaCampaigns, "investido");
  const totalGoogle = sumBy(googleCampaigns, "investido");
  const total = totalMeta + totalGoogle;

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="text-xs text-muted-foreground">Marketing › Tráfego › Pago</div>
        <h1 className="text-2xl font-semibold tracking-tight">Tráfego pago — Meta + Google</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Investido total</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtBRL(total)}</div>
        </div>
        <div className="rounded-lg border bg-card p-5" style={{ borderTop: "3px solid #1877F2" }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Facebook className="h-3.5 w-3.5" style={{ color: "#1877F2" }} /> Meta Ads
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtBRL(totalMeta)}</div>
          <div className="text-xs text-muted-foreground mt-1">{metaCampaigns.length} campanhas · {fmtNum(sumBy(metaCampaigns, "conversoes"))} leads</div>
        </div>
        <div className="rounded-lg border bg-card p-5" style={{ borderTop: "3px solid #EA4335" }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Chrome className="h-3.5 w-3.5" style={{ color: "#EA4335" }} /> Google Ads
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtBRL(totalGoogle)}</div>
          <div className="text-xs text-muted-foreground mt-1">{googleCampaigns.length} campanhas · {fmtNum(sumBy(googleCampaigns, "conversoes"))} leads</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Use a página <a className="underline text-primary" href="/marketing/visao-geral">Visão geral</a> para detalhamento por plataforma com tabela completa, criativos, públicos e palavras-chave.
      </div>
    </div>
  );
}
