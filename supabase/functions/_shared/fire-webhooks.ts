import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function fireWebhooks(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { data: webhooks, error } = await sb
    .from("webhooks")
    .select("id, url, secret, failure_count")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (error || !webhooks?.length) return;

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  await Promise.allSettled(
    webhooks.map(async (wh: { id: string; url: string; secret: string | null; failure_count: number }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-CRM-Event": event,
      };

      if (wh.secret) {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(wh.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
        headers["X-CRM-Signature"] = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      try {
        const res = await fetch(wh.url, { method: "POST", headers, body });
        if (res.ok) {
          await sb.from("webhooks").update({ last_triggered_at: new Date().toISOString(), failure_count: 0 }).eq("id", wh.id);
        } else {
          await sb.from("webhooks").update({ failure_count: wh.failure_count + 1 }).eq("id", wh.id);
        }
      } catch {
        await sb.from("webhooks").update({ failure_count: wh.failure_count + 1 }).eq("id", wh.id);
      }
    })
  );
}
