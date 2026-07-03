/**
 * Envio de e-mail pela conta Gmail da ORGANIZAÇÃO (server-side, service role).
 * Usado pelo motor de automações (process-automation) e pelo worker de
 * sequências (process-sequences). Mesma resolução de conta do gmail-send:
 * email_connections por finalidade → token em gmail_oauth_tokens →
 * refresh com as credenciais BYOK corretas → Gmail API → registro em emails.
 */

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value.normalize("NFC"));
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function wrapBase64(value: string) {
  return value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function encodeHeader(value: string) {
  const normalized = value.normalize("NFC");
  return /[^\x20-\x7E]/.test(normalized) ? `=?UTF-8?B?${utf8Base64(normalized)}?=` : normalized;
}

function asEmailHtml(value: string) {
  const html = value.normalize("NFC");
  if (/<!doctype|<html[\s>]/i.test(html)) return html;
  return `<!doctype html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
}

function encodeRaw(opts: { to: string; from: string; subject: string; html: string }) {
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(utf8Base64(asEmailHtml(opts.html))),
  ];
  const b64 = utf8Base64(lines.join("\r\n"));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function refreshAccessToken(refreshToken: string, cfg: Record<string, unknown>) {
  const clientId = (cfg.client_id as string) || Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = (cfg.client_secret as string) || Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
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
  if (!res.ok) throw new Error(`token refresh failed: ${JSON.stringify(data)}`);
  return data as { access_token: string; expires_in: number };
}

export interface OrgEmailOptions {
  orgId: string;
  to: string;
  subject: string;
  html: string;
  purpose?: "sales" | "marketing";
  contactId?: string | null;
  dealId?: string | null;
  /** usuário creditado como remetente no registro (null = sistema) */
  userId?: string | null;
}

/**
 * Envia um e-mail pela conta da org e registra na tabela emails.
 * Lança erro claro se a conta da finalidade não estiver conectada.
 * @param admin supabase client com service role
 */
export async function sendViaOrgAccount(admin: any, opts: OrgEmailOptions): Promise<{ id: string | null }> {
  const purpose = opts.purpose === "marketing" ? "marketing" : "sales";

  const { data: cfgRow } = await admin
    .from("integration_configs")
    .select("config")
    .eq("org_id", opts.orgId)
    .eq("provider", "gmail")
    .maybeSingle();
  const cfg: Record<string, unknown> = (cfgRow?.config as Record<string, unknown>) ?? {};

  const { data: connection } = await admin
    .from("email_connections")
    .select("*")
    .eq("org_id", opts.orgId)
    .eq("provider", "gmail")
    .eq("purpose", purpose)
    .eq("is_active", true)
    .maybeSingle();
  if (!connection) {
    throw new Error(`Conta Gmail ${purpose === "marketing" ? "Marketing" : "Comercial"} da empresa não conectada`);
  }

  const { data: tokenRow } = await admin
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("org_id", opts.orgId)
    .eq("email", connection.email_address)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tokenRow) throw new Error("Token OAuth da conta não encontrado — reconecte em Integrações");

  let accessToken = tokenRow.access_token as string;
  if (new Date(tokenRow.expires_at).getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token as string, cfg);
    accessToken = refreshed.access_token;
    await admin.from("gmail_oauth_tokens").update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);
  }

  const fromEmail = connection.email_address as string;
  const fromName = (connection.from_name as string) || (cfg.from_name as string) || "";
  const from = fromName ? `${encodeHeader(fromName)} <${fromEmail}>` : fromEmail;
  const signature = (connection.signature_html as string) ? `<br/><br/>${connection.signature_html}` : "";
  const finalHtml = `${opts.html}${signature}`;

  // Pré-registra para obter o id do rastreio de abertura/clique
  const { data: preInserted } = await admin.from("emails").insert({
    org_id: opts.orgId,
    user_id: opts.userId ?? null,
    contact_id: opts.contactId ?? null,
    deal_id: opts.dealId ?? null,
    direction: "outbound",
    subject: opts.subject,
    body_html: finalHtml,
    from_email: fromEmail,
    to_emails: [opts.to],
    cc_emails: [],
    bcc_emails: [],
    status: "sending",
    provider: "gmail",
    is_read: true,
    synced_from: fromEmail,
  }).select("id").maybeSingle();
  const emailId: string | null = preInserted?.id ?? null;

  let trackedHtml = finalHtml;
  if (emailId) {
    const trackBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-track`;
    trackedHtml = trackedHtml.replace(
      /href="(https?:\/\/[^"]+)"/gi,
      (_m: string, u: string) => `href="${trackBase}?e=${emailId}&t=click&u=${encodeURIComponent(u)}"`,
    );
    trackedHtml += `<img src="${trackBase}?e=${emailId}&t=open" width="1" height="1" style="display:none" alt=""/>`;
  }

  const raw = encodeRaw({ to: opts.to, from, subject: opts.subject, html: trackedHtml });

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const sendData = await sendRes.json();
  if (!sendRes.ok) {
    if (emailId) await admin.from("emails").delete().eq("id", emailId);
    throw new Error(`gmail send failed: ${JSON.stringify(sendData).slice(0, 300)}`);
  }

  if (emailId) {
    await admin.from("emails").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      thread_id: sendData.threadId ?? null,
      message_id: sendData.id ?? null,
    }).eq("id", emailId);
  }

  return { id: emailId };
}

/** Substituição de variáveis {{primeiro_nome}} etc. usada por automações e sequências */
export function renderTemplate(text: string, contact: Record<string, unknown> | null): string {
  if (!text) return "";
  const first = String(contact?.first_name ?? "");
  const last = String(contact?.last_name ?? "");
  return text
    .replace(/\{\{primeiro_nome\}\}/g, first)
    .replace(/\{\{sobrenome\}\}/g, last)
    .replace(/\{\{nome\}\}/g, `${first} ${last}`.trim())
    .replace(/\{\{email\}\}/g, String(contact?.email ?? ""));
}
