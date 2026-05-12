import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function encodeRaw(opts: { to: string; from: string; cc?: string; bcc?: string; subject: string; html?: string; text?: string }) {
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
  ];
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);
  lines.push(
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: text/${opts.html ? "html" : "plain"}; charset="UTF-8"`,
    "",
    opts.html ?? opts.text ?? "",
  );
  const raw = lines.join("\r\n");
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { org_id, user_id, contact_id, deal_id, to, cc, bcc, subject, html, text } = body;
    if (!org_id || !to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "org_id, to, subject and html/text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return new Response(JSON.stringify({ error: "gmail_not_linked" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await supabaseAdmin
      .from("integration_configs")
      .select("config, is_active")
      .eq("org_id", org_id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (!cfg || !cfg.is_active) {
      return new Response(JSON.stringify({ error: "gmail_not_configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const c: any = cfg.config;
    const fromEmail = c.email;
    const from = c.from_name ? `${c.from_name} <${fromEmail}>` : fromEmail;
    const finalHtml = html && c.signature ? `${html}<br/><br/>${(c.signature as string).replace(/\n/g, "<br/>")}` : html;
    const finalText = !html && text && c.signature ? `${text}\n\n${c.signature}` : text;

    const toList = Array.isArray(to) ? to : String(to).split(",").map((s: string) => s.trim()).filter(Boolean);
    const ccList = cc ? (Array.isArray(cc) ? cc : String(cc).split(",").map((s: string) => s.trim()).filter(Boolean)) : [];
    const bccList = bcc ? (Array.isArray(bcc) ? bcc : String(bcc).split(",").map((s: string) => s.trim()).filter(Boolean)) : [];

    const raw = encodeRaw({
      to: toList.join(", "),
      from,
      cc: ccList.length ? ccList.join(", ") : undefined,
      bcc: bccList.length ? bccList.join(", ") : undefined,
      subject,
      html: finalHtml,
      text: finalText,
    });

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "gmail_send_failed", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist into emails table for inbox visibility
    const { data: inserted, error: insErr } = await supabaseAdmin.from("emails").insert({
      org_id,
      user_id: user_id ?? null,
      contact_id: contact_id ?? null,
      deal_id: deal_id ?? null,
      direction: "outbound",
      subject,
      body_html: finalHtml ?? finalText ?? "",
      from_email: fromEmail,
      to_emails: toList,
      cc_emails: ccList,
      bcc_emails: bccList,
      status: "sent",
      provider: "gmail",
      sent_at: new Date().toISOString(),
      thread_id: data.threadId ?? null,
      message_id: data.id ?? null,
      is_read: true,
    }).select("id").maybeSingle();

    if (insErr) console.error("emails insert error:", insErr);

    return new Response(JSON.stringify({ ok: true, id: data.id, threadId: data.threadId, email_id: inserted?.id }), {
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
