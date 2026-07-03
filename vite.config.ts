import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://kschuwekbrrwmhzinsrv.supabase.co";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2h1d2VrYnJyd21oemluc3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTczODIsImV4cCI6MjA5NTYzMzM4Mn0.WdcNw7VhHzlXCDEMkgvVbgzUpmFyji2dGVmBSf6hkfQ";
  const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID || "kschuwekbrrwmhzinsrv";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Divide as libs pesadas em chunks próprios (cacheáveis entre deploys)
          // — o chunk principal caía tudo junto e passava de 880KB
          manualChunks: {
            recharts: ["recharts"],
            supabase: ["@supabase/supabase-js"],
            radix: [
              "@radix-ui/react-avatar", "@radix-ui/react-checkbox", "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu", "@radix-ui/react-label", "@radix-ui/react-popover",
              "@radix-ui/react-progress", "@radix-ui/react-scroll-area", "@radix-ui/react-select",
              "@radix-ui/react-separator", "@radix-ui/react-slot", "@radix-ui/react-switch",
              "@radix-ui/react-tabs", "@radix-ui/react-toast", "@radix-ui/react-tooltip",
            ],
            sentry: ["@sentry/react"],
          },
        },
      },
    },
  };
});
