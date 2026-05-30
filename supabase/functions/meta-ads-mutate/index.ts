import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('META_ACCESS_TOKEN');
    if (!token) return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), { status: 400, headers: corsHeaders });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    const orgId = profile?.org_id;
    if (!orgId) return new Response(JSON.stringify({ error: 'No org' }), { status: 400, headers: corsHeaders });

    const body = await req.json();
    const { action, campaign_id, status, daily_budget, ad_account_id, name, objective } = body;

    if (action === 'update_status') {
      const r = await fetch(`${GRAPH}/${campaign_id}?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      await supabase.from('meta_campaigns').update({ status, effective_status: status }).eq('meta_campaign_id', campaign_id).eq('org_id', orgId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_budget') {
      const r = await fetch(`${GRAPH}/${campaign_id}?access_token=${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_budget: Math.round(Number(daily_budget) * 100) }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      await supabase.from('meta_campaigns').update({ daily_budget }).eq('meta_campaign_id', campaign_id).eq('org_id', orgId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create_campaign') {
      const { data: acc } = await supabase.from('meta_ad_accounts').select('meta_account_id,id').eq('id', ad_account_id).eq('org_id', orgId).maybeSingle();
      if (!acc) return new Response(JSON.stringify({ error: 'Ad account not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const r = await fetch(`${GRAPH}/${acc.meta_account_id}/campaigns?access_token=${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, objective, status: 'PAUSED',
          special_ad_categories: [],
          daily_budget: daily_budget ? Math.round(Number(daily_budget) * 100) : undefined,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      await supabase.from('meta_campaigns').insert({
        org_id: orgId, ad_account_id: acc.id, meta_campaign_id: j.id,
        name, objective, status: 'PAUSED', effective_status: 'PAUSED',
        daily_budget: daily_budget || null, raw: j,
      });
      return new Response(JSON.stringify({ success: true, campaign_id: j.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error('meta-ads-mutate error', err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
