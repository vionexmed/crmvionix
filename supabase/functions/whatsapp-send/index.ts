import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GRAPH = 'https://graph.facebook.com/v21.0'

function normalize(phone: string) {
  return phone.replace(/\D/g, '')
}

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
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token)
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claims.claims.sub

    const body = await req.json().catch(() => ({}))
    const to = normalize(String(body.to || ''))
    const text = body.text ? String(body.text).slice(0, 4000) : null
    const template = body.template as { name: string; language: string; components?: any[] } | undefined
    const contactId = body.contactId || null
    const dealId = body.dealId || null

    if (!to || (!text && !template)) {
      return new Response(JSON.stringify({ error: 'Missing "to" and ("text" or "template")' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // get user org
    const { data: prof } = await admin.from('profiles').select('org_id').eq('id', userId).maybeSingle()
    const orgId = prof?.org_id
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'No organization' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: cfg } = await admin.from('whatsapp_config').select('*').eq('org_id', orgId).maybeSingle()
    if (!cfg || !cfg.is_active) {
      return new Response(JSON.stringify({ error: 'WhatsApp não configurado para esta organização' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN') || Deno.env.get('META_ACCESS_TOKEN')
    if (!META_TOKEN) {
      return new Response(JSON.stringify({ error: 'META_WHATSAPP_TOKEN não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: any = { messaging_product: 'whatsapp', to, recipient_type: 'individual' }
    if (template) {
      payload.type = 'template'
      payload.template = {
        name: template.name,
        language: { code: template.language || 'pt_BR' },
        components: template.components || [],
      }
    } else {
      payload.type = 'text'
      payload.text = { body: text }
    }

    const resp = await fetch(`${GRAPH}/${cfg.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const respJson = await resp.json()

    if (!resp.ok) {
      await admin.from('whatsapp_messages').insert({
        org_id: orgId, contact_id: contactId, deal_id: dealId,
        direction: 'outbound', from_number: cfg.display_phone_number || '',
        to_number: to, body: text || `[template:${template?.name}]`,
        message_type: template ? 'template' : 'text',
        status: 'failed', error_message: JSON.stringify(respJson).slice(0, 500),
        raw: respJson,
      })
      return new Response(JSON.stringify({ error: 'Meta API error', details: respJson }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const wamid = respJson?.messages?.[0]?.id || null
    await admin.from('whatsapp_messages').insert({
      org_id: orgId, contact_id: contactId, deal_id: dealId,
      direction: 'outbound', wa_message_id: wamid,
      from_number: cfg.display_phone_number || '', to_number: to,
      body: text || `[template:${template?.name}]`,
      message_type: template ? 'template' : 'text',
      status: 'sent', raw: respJson,
    })

    return new Response(JSON.stringify({ ok: true, wa_message_id: wamid }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('whatsapp-send error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
