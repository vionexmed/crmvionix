/**
 * Lightweight Sentry client for Deno edge functions.
 * Uses Sentry HTTP API directly — no external dependencies.
 * Enable by setting the SENTRY_DSN Supabase secret.
 */

function parseDsn(dsn: string): { endpoint: string; key: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/`,
      key: url.username,
    };
  } catch {
    return null;
  }
}

export async function captureException(
  err: unknown,
  context?: {
    functionName?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const error = err instanceof Error ? err : new Error(String(err));

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    runtime: { name: "deno" },
    tags: { function: context?.functionName ?? "unknown", ...context?.tags },
    extra: context?.extra,
    exception: {
      values: [
        {
          type: error.constructor.name,
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: error.stack
                  .split("\n")
                  .slice(1)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
  };

  try {
    await fetch(parsed.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=sentry-deno/1.0, sentry_key=${parsed.key}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Never let Sentry errors surface to the caller
  }
}
