ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS business_id text;
ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS business_name text;
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_org_business ON public.meta_ad_accounts(org_id, business_id);