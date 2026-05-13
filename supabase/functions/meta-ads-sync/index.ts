import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API = 'https://graph.facebook.com/v21.0';

async function metaFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_API}${path}`);
  url.searchParams.set('access_token', token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API error ${res.status}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = claims.claims.sub;
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', userId).single();
    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: 'No organization' }), { status: 400, headers: corsHeaders });
    }
    const orgId = profile.org_id;

    const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    if (!META_TOKEN) throw new Error('META_ACCESS_TOKEN not configured');

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full';

    const startTime = Date.now();
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let recordsSynced = 0;

    if (action === 'accounts' || action === 'full') {
      const accounts = await metaFetch('/me/adaccounts', META_TOKEN, {
        fields: 'id,name,account_status,currency,timezone_name',
        limit: '100',
      });

      for (const acc of accounts.data || []) {
        await adminClient.from('meta_ad_accounts').upsert({
          org_id: orgId,
          meta_account_id: acc.id,
          name: acc.name,
          currency: acc.currency,
          timezone_name: acc.timezone_name,
          account_status: acc.account_status,
        }, { onConflict: 'org_id,meta_account_id' });
        recordsSynced++;
      }
    }

    if (action === 'full' || action === 'campaigns') {
      const { data: accounts } = await adminClient
        .from('meta_ad_accounts')
        .select('id, meta_account_id')
        .eq('org_id', orgId);

      for (const acc of accounts || []) {
        const camps = await metaFetch(`/${acc.meta_account_id}/campaigns`, META_TOKEN, {
          fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
          limit: '200',
        });

        for (const c of camps.data || []) {
          const { data: campaign } = await adminClient.from('meta_campaigns').upsert({
            org_id: orgId,
            ad_account_id: acc.id,
            meta_campaign_id: c.id,
            name: c.name,
            objective: c.objective,
            status: c.status,
            effective_status: c.effective_status,
            daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
            lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
            start_time: c.start_time,
            stop_time: c.stop_time,
            created_time: c.created_time,
            updated_time: c.updated_time,
            raw: c,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'org_id,meta_campaign_id' }).select().single();
          recordsSynced++;

          // Sync insights last 30 days for this campaign
          if (campaign) {
            try {
              const insights = await metaFetch(`/${c.id}/insights`, META_TOKEN, {
                fields: 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values',
                date_preset: 'last_30d',
                time_increment: '1',
                limit: '100',
              });

              for (const ins of insights.data || []) {
                const conversions = (ins.actions || [])
                  .filter((a: any) => ['purchase', 'lead', 'complete_registration'].includes(a.action_type))
                  .reduce((s: number, a: any) => s + Number(a.value || 0), 0);
                const conversionValue = (ins.action_values || [])
                  .filter((a: any) => a.action_type === 'purchase')
                  .reduce((s: number, a: any) => s + Number(a.value || 0), 0);

                await adminClient.from('meta_insights').upsert({
                  org_id: orgId,
                  level: 'campaign',
                  entity_id: c.id,
                  campaign_id: campaign.id,
                  date_start: ins.date_start,
                  date_stop: ins.date_stop,
                  spend: Number(ins.spend || 0),
                  impressions: Number(ins.impressions || 0),
                  clicks: Number(ins.clicks || 0),
                  reach: Number(ins.reach || 0),
                  ctr: Number(ins.ctr || 0),
                  cpc: Number(ins.cpc || 0),
                  cpm: Number(ins.cpm || 0),
                  conversions,
                  conversion_value: conversionValue,
                  raw: ins,
                  synced_at: new Date().toISOString(),
                }, { onConflict: 'org_id,level,entity_id,date_start' });
                recordsSynced++;
              }
            } catch (e) {
              console.error('Insights error for campaign', c.id, e);
            }
          }
        }
      }
    }

    await adminClient.from('meta_sync_log').insert({
      org_id: orgId,
      sync_type: action,
      status: 'success',
      records_synced: recordsSynced,
      duration_ms: Date.now() - startTime,
      finished_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, records_synced: recordsSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('meta-ads-sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
