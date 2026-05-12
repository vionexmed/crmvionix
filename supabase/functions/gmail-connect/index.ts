import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function exchangeRefreshToken(client_id: string, client_secret: string, refresh_token: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "token_exchange_failed");
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, config } = await req.json();
    if (!org_id || !config?.client_id || !config?.client_secret || !config?.refresh_token) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let access_token: string;
    try {
      access_token = await exchangeRefreshToken(config.client_id, config.client_secret, config.refresh_token);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "invalid_credentials", message: (e as Error).message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) {
      const text = await profileRes.text();
      return new Response(
        JSON.stringify({ error: "gmail_profile_failed", message: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const profile = await profileRes.json();
    const email = profile.emailAddress as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const merged = { ...config, email };

    const { data: existing } = await supabaseAdmin
      .from("integration_configs")
      .select("id")
      .eq("org_id", org_id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("integration_configs")
        .update({ config: merged, is_active: true, connected_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("integration_configs").insert({
        org_id,
        provider: "gmail",
        config: merged,
        is_active: true,
        connected_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-connect error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
