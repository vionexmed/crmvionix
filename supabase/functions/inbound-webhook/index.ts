import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(sbUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(sbUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await sb.from("profiles").select("org_id").eq("id", userData.user.id).maybeSingle();
    const orgId = profile?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { entity, action, data } = body;

    if (!entity || !data) return new Response(JSON.stringify({ error: "entity and data required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


    const tableName = entity === "contact" ? "contacts"
      : entity === "company" ? "companies"
      : entity === "deal" ? "deals"
      : entity === "activity" ? "activities"
      : null;

    if (!tableName) return new Response(JSON.stringify({ error: "Invalid entity" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const record = { ...data, org_id: orgId };

    let result;
    if (action === "create" || !action) {
      result = await sb.from(tableName).insert(record).select().single();
    } else if (action === "update" && data.id) {
      const { id, ...rest } = data;
      result = await sb.from(tableName).update({ ...rest }).eq("id", id).eq("org_id", orgId).select().single();
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: result.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbound-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
