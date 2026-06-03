import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2,
  integrations: [Sentry.browserTracingIntegration()],
});

// Apply saved theme or default to dark
const savedTheme = localStorage.getItem("fc-theme") || "light";
if (savedTheme === "system") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.add(prefersDark ? "dark" : "light");
} else {
  document.documentElement.classList.add(savedTheme);
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Algo deu errado. Recarregue a página.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
