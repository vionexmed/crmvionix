import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function decodeBase64Url(s: string): string {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const bytes = atob(b64 + pad);
    return decodeURIComponent(escape(bytes));
  } catch {
    return "";
  }
}

function getHeader(headers: any[], name: string): string | null {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

function extractBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";
  const walk = (part: any) => {
    if (!part) return;
    const mt = part.mimeType || "";
    const filename = part.filename || "";
    // Skip attachments from body extraction
    if (filename) {
      if (Array.isArray(part.parts)) part.parts.forEach(walk);
      return;
    }
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mt === "text/html" && !html) html = decoded;
      else if (mt === "text/plain" && !text) text = decoded;
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return { html, text };
}

function extractAttachments(payload: any): Array<{ filename: string; mime_type: string; size: number; attachment_id: string; part_id?: string }> {
  const out: Array<any> = [];
  const walk = (part: any) => {
    if (!part) return;
    const filename = part.filename || "";
    if (filename && part.body?.attachmentId) {
      out.push({
        filename,
        mime_type: part.mimeType || "application/octet-stream",
        size: Number(part.body.size || 0),
        attachment_id: part.body.attachmentId,
        part_id: part.partId,
      });
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return out;
}

function parseAddrList(s: string | null): string[] {
  if (!s) return [];
  return s.split(",").map((p) => {
    const m = p.match(/<([^>]+)>/);
    return (m ? m[1] : p).trim();
  }).filter(Boolean);
}

function parseSingleAddr(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

async function gmailFetch(path: string, key: string, lovable: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": key,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, max = 25 } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
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

    // List inbox messages
    const list = await gmailFetch(
      `/users/me/messages?maxResults=${Math.min(Number(max) || 25, 100)}&labelIds=INBOX`,
      GOOGLE_MAIL_API_KEY, LOVABLE_API_KEY,
    );
    const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip ones we already have
    const { data: existing } = await supabaseAdmin
      .from("emails")
      .select("message_id")
      .eq("org_id", org_id)
      .in("message_id", ids);
    const have = new Set((existing ?? []).map((e: any) => e.message_id));
    const toFetch = ids.filter((id) => !have.has(id));

    let synced = 0;
    for (const id of toFetch) {
      try {
        const msg = await gmailFetch(`/users/me/messages/${id}?format=full`, GOOGLE_MAIL_API_KEY, LOVABLE_API_KEY);
        const headers = msg.payload?.headers ?? [];
        const subject = getHeader(headers, "Subject");
        const fromEmail = parseSingleAddr(getHeader(headers, "From"));
        const toEmails = parseAddrList(getHeader(headers, "To"));
        const ccEmails = parseAddrList(getHeader(headers, "Cc"));
        const dateHeader = getHeader(headers, "Date");
        const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(Number(msg.internalDate)).toISOString();
        const { html, text } = extractBody(msg.payload);
        const attachments = extractAttachments(msg.payload);
        const isUnread = (msg.labelIds ?? []).includes("UNREAD");

        // Try to match contact by from_email
        let contactId: string | null = null;
        if (fromEmail) {
          const { data: c } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("org_id", org_id)
            .ilike("email", fromEmail)
            .maybeSingle();
          contactId = c?.id ?? null;
        }

        await supabaseAdmin.from("emails").insert({
          org_id,
          contact_id: contactId,
          direction: "inbound",
          subject: subject || "(sem assunto)",
          body_html: html || `<pre style="white-space:pre-wrap;font-family:inherit">${(text || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</pre>`,
          from_email: fromEmail,
          to_emails: toEmails,
          cc_emails: ccEmails,
          status: "received",
          provider: "gmail",
          message_id: id,
          thread_id: msg.threadId ?? null,
          is_read: !isUnread,
          sent_at: sentAt,
          attachments,
        });
        synced++;
      } catch (e) {
        console.error("sync msg fail", id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, synced, total_listed: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-sync error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
