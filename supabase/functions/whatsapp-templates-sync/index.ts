import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims } = await supabase.auth.getClaims(token)
    const userId = claims?.claims?.sub
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: prof } = await admin.from('profiles').select('org_id').eq('id', userId).maybeSingle()
    const orgId = prof?.org_id
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'No organization' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: cfg } = await admin.from('whatsapp_config').select('*').eq('org_id', orgId).maybeSingle()
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'WhatsApp não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN') || Deno.env.get('META_ACCESS_TOKEN')
    if (!META_TOKEN) {
      return new Response(JSON.stringify({ error: 'META_WHATSAPP_TOKEN não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Test: GET phone number details
    const resp = await fetch(`${GRAPH}/${cfg.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    })
    const data = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: data }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update display info
    await admin.from('whatsapp_config').update({
      display_phone_number: data.display_phone_number,
      verified_name: data.verified_name,
    }).eq('id', cfg.id)

    // Sync templates
    const tResp = await fetch(`${GRAPH}/${cfg.waba_id}/message_templates?limit=200`, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    })
    const tData = await tResp.json()
    if (tResp.ok && Array.isArray(tData?.data)) {
      for (const t of tData.data) {
        await admin.from('whatsapp_templates').upsert({
          org_id: orgId,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components || [],
          synced_at: new Date().toISOString(),
        }, { onConflict: 'org_id,name,language' })
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      phone: data,
      templates_synced: Array.isArray(tData?.data) ? tData.data.length : 0,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
