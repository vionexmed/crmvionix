/**
 * Structured JSON logger for Supabase edge functions.
 * Outputs logs that Supabase Logs can parse and filter by level/function/data.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  fn: string;
  msg: string;
  ts: string;
  data?: Record<string, unknown>;
}

function emit(level: LogLevel, fn: string, msg: string, data?: Record<string, unknown>) {
  const entry: LogEntry = { level, fn, msg, ts: new Date().toISOString() };
  if (data && Object.keys(data).length > 0) entry.data = data;
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(functionName: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit("debug", functionName, msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => emit("info",  functionName, msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => emit("warn",  functionName, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", functionName, msg, data),
  };
}
