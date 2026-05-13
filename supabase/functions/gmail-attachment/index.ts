import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  return data as { access_token: string; expires_in: number };
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

    const { message_id, attachment_id, mime_type } = await req.json();
    if (!message_id || !attachment_id) {
      return new Response(JSON.stringify({ error: "message_id and attachment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find a Gmail token (any user in same org would work; prefer current user)
    let { data: tokenRow } = await supabaseAdmin
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow) {
      // fall back to any token in user's org
      const { data: prof } = await supabaseAdmin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
      if (prof?.org_id) {
        const { data: ids } = await supabaseAdmin.from("profiles").select("id").eq("org_id", prof.org_id);
        const userIds = (ids || []).map((p: any) => p.id);
        const { data: anyTok } = await supabaseAdmin
          .from("gmail_oauth_tokens")
          .select("*")
          .in("user_id", userIds)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        tokenRow = anyTok as any;
      }
    }

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "gmail_not_connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token as string;
    if (new Date(tokenRow.expires_at).getTime() - Date.now() < 60_000) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token as string);
      accessToken = refreshed.access_token;
      await supabaseAdmin.from("gmail_oauth_tokens").update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", tokenRow.id);
    }

    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message_id)}/attachments/${encodeURIComponent(attachment_id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "gmail_fetch_failed", details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // base64url -> base64
    const b64url = (data.data || "") as string;
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const dataUrl = `data:${mime_type || "application/octet-stream"};base64,${b64}`;

    return new Response(JSON.stringify({ ok: true, data_url: dataUrl, size: data.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-attachment error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
