import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function encodeRaw(opts: { to: string; from: string; cc?: string; bcc?: string; subject: string; html?: string; text?: string }) {
  const lines = [`To: ${opts.to}`, `From: ${opts.from}`];
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

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`refresh failed: ${JSON.stringify(data)}`);
  return data as { access_token: string; expires_in: number; scope?: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: cl } = await supabase.auth.getClaims(token);
    if (!cl?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = cl.claims.sub;

    const body = await req.json();
    const { org_id, contact_id, deal_id, to, cc, bcc, subject, html, text } = body;
    if (!org_id || !to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "org_id, to, subject and html/text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load integration config first to decide auth mode (connector vs oauth_byok)
    const { data: cfgRow } = await supabaseAdmin
      .from("integration_configs")
      .select("config")
      .eq("org_id", org_id)
      .eq("provider", "gmail")
      .maybeSingle();
    const cfg: any = cfgRow?.config ?? {};
    const mode: string = cfg.mode || "oauth_byok";

    let accessToken = "";
    let fromEmail = "";
    let useConnector = false;
    let connectorApiKey = "";
    let lovableApiKey = "";

    if (mode === "connector") {
      connectorApiKey = Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "";
      lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
      if (!connectorApiKey || !lovableApiKey) {
        return new Response(JSON.stringify({ error: "gmail_not_connected", message: "Conector Gmail não está vinculado ao projeto." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      useConnector = true;
      fromEmail = cfg.email || "";
    } else {
      const { data: tokenRow } = await supabaseAdmin
        .from("gmail_oauth_tokens")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: "gmail_not_connected", message: "Conecte sua conta Gmail em Integrações." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = tokenRow.access_token as string;
      if (new Date(tokenRow.expires_at).getTime() - Date.now() < 60_000) {
        const refreshed = await refreshAccessToken(tokenRow.refresh_token as string);
        accessToken = refreshed.access_token;
        await supabaseAdmin.from("gmail_oauth_tokens").update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", tokenRow.id);
      }
      fromEmail = tokenRow.email as string;
    }

    const from = cfg.from_name ? `${cfg.from_name} <${fromEmail}>` : fromEmail;

    // Fallback: per-user default signature stored in email_signatures
    const { data: sigRow } = await supabaseAdmin
      .from("email_signatures")
      .select("html")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    const fallbackSignatureHtml: string = sigRow?.html ?? "";

    const escapeHtml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&#39;" }[c] as string));
    const buildSignatureHtml = (): string => {
      const hasStructured = cfg.signature_name || cfg.signature_role || cfg.signature_company || cfg.signature_phone || cfg.signature_email || cfg.signature_website || cfg.signature_logo_url || cfg.signature_extra;
      if (hasStructured) {
        const rows: string[] = [];
        if (cfg.signature_name) rows.push(`<div style="font-weight:600;color:#111;font-size:14px">${escapeHtml(cfg.signature_name)}</div>`);
        if (cfg.signature_role || cfg.signature_company) {
          const rc = [cfg.signature_role, cfg.signature_company].filter(Boolean).map(escapeHtml).join(" · ");
          rows.push(`<div style="color:#444;font-size:12px">${rc}</div>`);
        }
        const contactParts: string[] = [];
        if (cfg.signature_phone) contactParts.push(`<a href="tel:${escapeHtml(String(cfg.signature_phone).replace(/[^+\d]/g,""))}" style="color:#444;text-decoration:none">${escapeHtml(cfg.signature_phone)}</a>`);
        if (cfg.signature_email) contactParts.push(`<a href="mailto:${escapeHtml(cfg.signature_email)}" style="color:#444;text-decoration:none">${escapeHtml(cfg.signature_email)}</a>`);
        if (cfg.signature_website) {
          const url = String(cfg.signature_website).startsWith("http") ? cfg.signature_website : `https://${cfg.signature_website}`;
          contactParts.push(`<a href="${escapeHtml(url)}" style="color:#444;text-decoration:none">${escapeHtml(cfg.signature_website)}</a>`);
        }
        if (contactParts.length) rows.push(`<div style="color:#666;font-size:12px;margin-top:4px">${contactParts.join(" &nbsp;|&nbsp; ")}</div>`);
        if (cfg.signature_extra) rows.push(`<div style="color:#666;font-size:12px;margin-top:4px">${escapeHtml(cfg.signature_extra).replace(/\n/g,"<br/>")}</div>`);
        const logo = cfg.signature_logo_url
          ? `<td style="padding-right:14px;vertical-align:top"><img src="${escapeHtml(cfg.signature_logo_url)}" alt="" style="max-height:64px;max-width:140px;display:block"/></td>`
          : "";
        return `<br/><br/><table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;border-top:1px solid #e5e5e5;padding-top:10px;margin-top:10px"><tr>${logo}<td style="vertical-align:top">${rows.join("")}</td></tr></table>`;
      }
      if (cfg.signature) return `<br/><br/>${(cfg.signature as string).replace(/\n/g, "<br/>")}`;
      if (fallbackSignatureHtml) return `<br/><br/>${fallbackSignatureHtml}`;
      return "";
    };

    const signatureHtml = buildSignatureHtml();
    const alreadyHasSignature = !!(html && signatureHtml && html.includes(signatureHtml.slice(0, 80)));
    const finalHtml = html ? (alreadyHasSignature ? html : `${html}${signatureHtml}`) : (signatureHtml || undefined);
    const plainSig = cfg.signature || (fallbackSignatureHtml ? fallbackSignatureHtml.replace(/<[^>]+>/g, "") : "");
    const finalText = !html && text ? (plainSig ? `${text}\n\n${plainSig}` : text) : text;

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

    const sendUrl = useConnector
      ? "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send"
      : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const sendHeaders: Record<string, string> = useConnector
      ? {
          Authorization: `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": connectorApiKey,
          "Content-Type": "application/json",
        }
      : { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: sendHeaders,
      body: JSON.stringify({ raw }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      console.error("gmail send error", sendData);
      return new Response(JSON.stringify({ error: "gmail_send_failed", details: sendData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted } = await supabaseAdmin.from("emails").insert({
      org_id,
      user_id: userId,
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
      thread_id: sendData.threadId ?? null,
      message_id: sendData.id ?? null,
      is_read: true,
    }).select("id").maybeSingle();

    return new Response(JSON.stringify({ ok: true, id: sendData.id, threadId: sendData.threadId, email_id: inserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-send error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
