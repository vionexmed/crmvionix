import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Sentry: ativo somente quando VITE_SENTRY_DSN estiver definido
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

// Apply saved theme
const savedTheme = localStorage.getItem("fc-theme") || "light";
if (savedTheme === "system") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.add(prefersDark ? "dark" : "light");
} else {
  document.documentElement.classList.add(savedTheme);
}

createRoot(document.getElementById("root")!).render(<App />);
