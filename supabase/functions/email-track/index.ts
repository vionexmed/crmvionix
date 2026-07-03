import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Rastreio de e-mail (público, sem JWT — é acessado pelo Gmail do destinatário):
 *   GET /email-track?e=<email_id>&t=open          → pixel 1x1 + incrementa open_count
 *   GET /email-track?e=<email_id>&t=click&u=<url> → incrementa click_count + redireciona
 *
 * Os contadores open_count/click_count sempre existiram na Inbox,
 * mas nada os alimentava — este endpoint fecha o ciclo.
 */

// GIF transparente 1x1
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

const pixelResponse = () =>
  new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("e");
  const type = url.searchParams.get("t");
  const target = url.searchParams.get("u");

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validId = !!emailId && uuidRe.test(emailId);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (validId && (type === "open" || type === "click")) {
      // Incremento atômico via RPC (migration 20260702150000)
      await admin.rpc("track_email_event", { p_email_id: emailId, p_event: type });
    }
  } catch (e) {
    console.error("email-track error:", e);
    // nunca falha para o destinatário
  }

  if (type === "click") {
    // Redireciona apenas para http(s) — nada de javascript:/data:
    let dest = "https://vionex.med.br";
    try {
      const parsed = new URL(target ?? "");
      if (parsed.protocol === "http:" || parsed.protocol === "https:") dest = parsed.toString();
    } catch { /* usa fallback */ }
    return new Response(null, { status: 302, headers: { Location: dest, "Cache-Control": "no-store" } });
  }

  return pixelResponse();
});
