import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API = 'https://graph.facebook.com/v21.0';

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
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    if (!META_TOKEN) throw new Error('META_ACCESS_TOKEN not configured');

    const body = await req.json();
    const { action, meta_campaign_id, meta_account_id, payload } = body;

    let result: any;

    if (action === 'update_status') {
      // payload: { status: 'PAUSED' | 'ACTIVE' }
      const res = await fetch(`${META_API}/${meta_campaign_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          status: payload.status,
          access_token: META_TOKEN,
        }),
      });
      result = await res.json();
      if (result.error) throw new Error(result.error.message);
    } else if (action === 'update_budget') {
      // payload: { daily_budget?: number, lifetime_budget?: number } (in main currency unit)
      const params: Record<string, string> = { access_token: META_TOKEN };
      if (payload.daily_budget) params.daily_budget = String(Math.round(payload.daily_budget * 100));
      if (payload.lifetime_budget) params.lifetime_budget = String(Math.round(payload.lifetime_budget * 100));
      const res = await fetch(`${META_API}/${meta_campaign_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      result = await res.json();
      if (result.error) throw new Error(result.error.message);
    } else if (action === 'create_campaign') {
      // payload: { name, objective, status, daily_budget? }
      const params: Record<string, string> = {
        name: payload.name,
        objective: payload.objective,
        status: payload.status || 'PAUSED',
        special_ad_categories: '[]',
        access_token: META_TOKEN,
      };
      if (payload.daily_budget) params.daily_budget = String(Math.round(payload.daily_budget * 100));
      const res = await fetch(`${META_API}/${meta_account_id}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      result = await res.json();
      if (result.error) throw new Error(result.error.message);
    } else {
      throw new Error('Unknown action');
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('meta-ads-mutate error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
