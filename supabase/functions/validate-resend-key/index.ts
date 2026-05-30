import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ valid: false, error_code: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ valid: false, error_code: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await supabaseAdmin.from("profiles").select("org_id").eq("id", userData.user.id).maybeSingle();
    const callerOrgId = profile?.org_id;
    if (!callerOrgId) {
      return new Response(JSON.stringify({ valid: false, error_code: "no_org" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { api_key, from_email, from_name, test_to } = await req.json();
    const org_id = callerOrgId;

    if (!api_key || !from_email || !test_to) {
      return new Response(
        JSON.stringify({ valid: false, error_code: "invalid_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send test email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${from_name || "VIONEX"} <${from_email}>`,
        to: [test_to],
        subject: "✓ VIONEX conectado com sucesso!",
        html: "<h2>✓ VIONEX conectado!</h2><p>Seu VIONEX está configurado para enviar emails. Pode fechar este email.</p>",
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      const errorMessage = resData?.message || resData?.name || "";

      if (errorMessage.toLowerCase().includes("domain") || errorMessage.toLowerCase().includes("verify")) {
        return new Response(
          JSON.stringify({ valid: false, error_code: "domain_not_verified" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: false, error_code: "invalid_key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save credentials for caller's org
    {

      // Store API key in org_secrets
      await supabaseAdmin.from("org_secrets").upsert(
        { org_id, key_name: "resend_api_key", key_value: api_key },
        { onConflict: "org_id,key_name" }
      );

      // Save to integration_configs
      const { data: existing } = await supabaseAdmin.from("integration_configs").select("id").eq("org_id", org_id).eq("provider", "resend").maybeSingle();
      if (existing) {
        await supabaseAdmin.from("integration_configs").update({
          config: { from_email, from_name: from_name || "VIONEX", configured: true },
          is_active: true,
        }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("integration_configs").insert({
          org_id,
          provider: "resend",
          config: { from_email, from_name: from_name || "VIONEX", configured: true },
          is_active: true,
        });
      }
    }

    return new Response(
      JSON.stringify({ valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-resend-key error:", err);
    return new Response(
      JSON.stringify({ valid: false, error_code: "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
