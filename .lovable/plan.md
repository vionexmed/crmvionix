
## Visão Geral

Criar uma nova área **Marketing** no CRM com integração ao **Meta Ads (Facebook/Instagram)** para listar contas de anúncio, visualizar campanhas, conjuntos de anúncios e anúncios, acompanhar métricas (gasto, impressões, cliques, CPC, CPM, CTR, conversões) e criar/pausar/ativar campanhas direto do CRM.

> ⚠️ **Segurança do token:** o token que você colou no chat ficou exposto publicamente. Recomendo **revogá-lo no Meta Business** e gerar um novo. O novo token será armazenado de forma segura em **Lovable Cloud Secrets** (`META_ACCESS_TOKEN`), nunca no código.

---

## Estrutura

### 1. Banco de dados (nova migração no schema único)

- `meta_ad_accounts` — contas de anúncio conectadas (act_id, nome, moeda, status, org_id)
- `meta_campaigns` — cache de campanhas (id Meta, account_id, nome, objetivo, status, budget, datas)
- `meta_adsets` — conjuntos de anúncios
- `meta_ads` — anúncios individuais
- `meta_insights` — métricas diárias (spend, impressions, clicks, ctr, cpc, cpm, conversions, date)
- `meta_sync_log` — histórico de sincronizações

Todas com RLS por `org_id` seguindo o padrão do projeto.

### 2. Edge Functions

- `meta-ads-sync` — busca contas/campanhas/insights via Graph API e cacheia no DB
- `meta-ads-mutate` — criar/pausar/ativar/atualizar budget de campanhas
- `meta-ads-accounts` — lista contas de anúncio disponíveis no token

Schedule via `pg_cron`: sincronização automática a cada 6h.

### 3. Frontend — Nova rota `/marketing`

**Sidebar:** novo grupo **Marketing** com itens:
- Visão Geral (`/marketing`)
- Campanhas (`/marketing/campaigns`)
- Insights (`/marketing/insights`)

**Páginas:**

- **Visão Geral:** KPIs do mês (gasto total, impressões, CTR médio, CPC médio, conversões), gráfico de gasto x conversões nos últimos 30 dias, top 5 campanhas por ROI.
- **Campanhas:** tabela densa estilo Pipedrive com filtros (status, objetivo, conta), ações inline (pausar/ativar), botão "Nova campanha" abrindo modal com nome/objetivo/budget/datas.
- **Detalhe da campanha:** drill-down por adset → ad com métricas, gráfico temporal (Recharts).
- **Insights:** filtros por período, breakdown por campanha/idade/gênero/dispositivo.

### 4. Configurações

Página `/settings/integrations` ganha card **Meta Ads** com:
- Status da conexão
- Botão "Conectar conta" (abre modal pedindo o token, salva via edge function em secret)
- Seleção da conta de anúncio padrão
- Botão "Sincronizar agora"

---

## Detalhes técnicos

- **API:** Meta Graph API v21.0 (`graph.facebook.com/v21.0`)
- **Endpoints principais:** `/me/adaccounts`, `/{act_id}/campaigns`, `/{campaign_id}/insights`
- **Auth:** token de longa duração armazenado em `META_ACCESS_TOKEN` (secret). Validação na edge function antes de cada chamada.
- **Cache:** dados de campanhas/insights persistidos no DB para resposta rápida + sync periódico.
- **React Query:** staleTime 5min seguindo o padrão atual.
- **Tipos:** novo arquivo `src/types/meta-ads.ts`.
- **Ícones:** `Megaphone`, `BarChart3`, `Target` do lucide-react.
- **Componentes:** seguir padrão Attio/Linear já usado no projeto.

---

## Fora do escopo desta iteração

- Criação de criativos/imagens (apenas estrutura de campanha/budget)
- Audiences/Custom Audiences
- Pixel/Conversion API
- Google Ads, TikTok Ads, LinkedIn Ads (podem vir em iterações futuras)

---

## Próximos passos após aprovação

1. Você **revoga o token exposto** e gera um novo no Meta Business Manager.
2. Eu peço o novo token via ferramenta segura de secrets (formulário criptografado).
3. Implemento DB → edge functions → UI nessa ordem.
