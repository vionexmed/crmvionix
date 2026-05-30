
-- Meta Ad Accounts
CREATE TABLE public.meta_ad_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  meta_account_id text NOT NULL,
  name text NOT NULL,
  currency text,
  timezone_name text,
  account_status integer,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, meta_account_id)
);
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ad accounts" ON public.meta_ad_accounts FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert ad accounts" ON public.meta_ad_accounts FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can update ad accounts" ON public.meta_ad_accounts FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete ad accounts" ON public.meta_ad_accounts FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));

-- Meta Campaigns
CREATE TABLE public.meta_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  meta_campaign_id text NOT NULL,
  name text NOT NULL,
  objective text,
  status text,
  effective_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  raw jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(org_id, meta_campaign_id)
);
CREATE INDEX idx_meta_campaigns_account ON public.meta_campaigns(ad_account_id);
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view campaigns" ON public.meta_campaigns FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert campaigns" ON public.meta_campaigns FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can update campaigns" ON public.meta_campaigns FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete campaigns" ON public.meta_campaigns FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));

-- Meta Adsets
CREATE TABLE public.meta_adsets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  meta_adset_id text NOT NULL,
  name text NOT NULL,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  optimization_goal text,
  billing_event text,
  raw jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(org_id, meta_adset_id)
);
CREATE INDEX idx_meta_adsets_campaign ON public.meta_adsets(campaign_id);
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view adsets" ON public.meta_adsets FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert adsets" ON public.meta_adsets FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can update adsets" ON public.meta_adsets FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete adsets" ON public.meta_adsets FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));

-- Meta Ads
CREATE TABLE public.meta_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  adset_id uuid NOT NULL REFERENCES public.meta_adsets(id) ON DELETE CASCADE,
  meta_ad_id text NOT NULL,
  name text NOT NULL,
  status text,
  creative_id text,
  raw jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(org_id, meta_ad_id)
);
CREATE INDEX idx_meta_ads_adset ON public.meta_ads(adset_id);
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ads" ON public.meta_ads FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert ads" ON public.meta_ads FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can update ads" ON public.meta_ads FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete ads" ON public.meta_ads FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));

-- Meta Insights (daily metrics)
CREATE TABLE public.meta_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  level text NOT NULL,
  entity_id text NOT NULL,
  campaign_id uuid REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_stop date NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  conversions numeric DEFAULT 0,
  conversion_value numeric DEFAULT 0,
  raw jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(org_id, level, entity_id, date_start)
);
CREATE INDEX idx_meta_insights_org_date ON public.meta_insights(org_id, date_start DESC);
CREATE INDEX idx_meta_insights_campaign ON public.meta_insights(campaign_id);
ALTER TABLE public.meta_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view insights" ON public.meta_insights FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert insights" ON public.meta_insights FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can update insights" ON public.meta_insights FOR UPDATE USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete insights" ON public.meta_insights FOR DELETE USING (user_belongs_to_org(auth.uid(), org_id));

-- Meta Sync Log
CREATE TABLE public.meta_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL,
  records_synced integer DEFAULT 0,
  error_message text,
  duration_ms integer,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_meta_sync_log_org ON public.meta_sync_log(org_id, started_at DESC);
ALTER TABLE public.meta_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view sync log" ON public.meta_sync_log FOR SELECT USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert sync log" ON public.meta_sync_log FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

-- Trigger updated_at
CREATE TRIGGER trg_meta_ad_accounts_updated_at BEFORE UPDATE ON public.meta_ad_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
