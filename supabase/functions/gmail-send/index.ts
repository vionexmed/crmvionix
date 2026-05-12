import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(client_id: string, client_secret: string, refresh_token: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "token_exchange_failed");
  return data.access_token as string;
}

function encodeRaw(opts: { to: string; from: string; subject: string; html?: string; text?: string }) {
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: text/${opts.html ? "html" : "plain"}; charset="UTF-8"`,
    "",
    opts.html ?? opts.text ?? "",
  ];
  const raw = lines.join("\r\n");
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, to, subject, html, text } = await req.json();
    if (!org_id || !to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "org_id, to, subject and html/text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("integration_configs")
      .select("config, is_active")
      .eq("org_id", org_id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (cfgErr || !cfg || !cfg.is_active) {
      return new Response(JSON.stringify({ error: "gmail_not_configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const c: any = cfg.config;
    const access_token = await getAccessToken(c.client_id, c.client_secret, c.refresh_token);

    const fromEmail = c.email;
    const from = c.from_name ? `${c.from_name} <${fromEmail}>` : fromEmail;
    const finalHtml = html && c.signature ? `${html}<br/><br/>${(c.signature as string).replace(/\n/g, "<br/>")}` : html;
    const finalText = !html && text && c.signature ? `${text}\n\n${c.signature}` : text;

    const raw = encodeRaw({ to, from, subject, html: finalHtml, text: finalText });

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "gmail_send_failed", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id, threadId: data.threadId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-send error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
