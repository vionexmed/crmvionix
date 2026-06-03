import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Derive org_id server-side from authenticated user's profile
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("org_id").eq("id", userId).maybeSingle();
    const org_id = profile?.org_id;
    if (!org_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull tokens from the server-side store (gmail_oauth_tokens) — never trust client tokens
    const { data: tokenRow } = await supabaseAdmin
      .from("gmail_oauth_tokens")
      .select("access_token, email")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return new Response(JSON.stringify({ error: "gmail_not_connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const access_token = tokenRow.access_token as string;

    // Get user's Gmail profile
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to access Gmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gmailProfile = await profileRes.json();
    const emailAddress = gmailProfile.emailAddress;

    // Save email connection (multi-account: conflict on user+provider+email)
    await supabaseAdmin.from("email_connections").upsert({
      user_id: userId,
      org_id,
      provider: "gmail",
      email_address: emailAddress,
      is_active: true,
    }, { onConflict: "user_id,provider,email_address" }).catch(() => {});

    // Fetch last 90 days of emails (paginated, background)
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    const query = `after:${ninetyDaysAgo}`;

    let pageToken = "";
    let totalImported = 0;
    const maxPages = 5;
    let page = 0;

    while (page < maxPages) {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      url.searchParams.set("q", query);
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!listRes.ok) break;
      const listData = await listRes.json();
      const messages = listData.messages || [];
      totalImported += messages.length;

      if (!listData.nextPageToken) break;
      pageToken = listData.nextPageToken;
      page++;
    }

    console.log(`gmail-initial-sync: imported ${totalImported} message references for org ${org_id}`);

    return new Response(
      JSON.stringify({ ok: true, email: emailAddress, messages_found: totalImported }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("gmail-initial-sync error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
