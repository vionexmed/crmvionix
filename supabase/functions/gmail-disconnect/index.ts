import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Desconecta uma conta Gmail da EMPRESA por completo:
 * remove a conexão, os tokens OAuth daquele e-mail e limpa o e-mail
 * do integration_configs se apontava para essa conta.
 * (Antes o app apagava só a linha de email_connections e deixava o
 * token vivo — a conta continuava sendo usada no envio.)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await anonClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { connection_id } = await req.json();
    if (!connection_id) return json({ error: "connection_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Org do chamador + verificação de papel admin/owner
    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
    const orgId = profile?.org_id;
    if (!orgId) return json({ error: "No organization" }, 403);

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
    if (roleRow?.role !== "owner" && roleRow?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    // A conexão precisa pertencer à org do chamador
    const { data: conn } = await admin
      .from("email_connections")
      .select("id, org_id, email_address")
      .eq("id", connection_id)
      .maybeSingle();
    if (!conn || conn.org_id !== orgId) return json({ error: "Connection not found" }, 404);

    await admin.from("gmail_oauth_tokens").delete()
      .eq("org_id", orgId).eq("email", conn.email_address);
    await admin.from("email_connections").delete().eq("id", conn.id);

    // Limpa o e-mail do integration_configs se apontava para essa conta
    const { data: cfgRow } = await admin
      .from("integration_configs")
      .select("id, config")
      .eq("org_id", orgId)
      .eq("provider", "gmail")
      .maybeSingle();
    const cfg = (cfgRow?.config as Record<string, unknown>) ?? {};
    if (cfgRow && cfg.email === conn.email_address) {
      await admin.from("integration_configs")
        .update({ config: { ...cfg, email: null } })
        .eq("id", cfgRow.id);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("gmail-disconnect error:", err);
    return json({ error: "internal_error", message: (err as Error).message }, 500);
  }
});
