import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineDetector } from "@/components/OfflineDetector";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

/**
 * Wrapper para lazy() que detecta falha de chunk (erro de MIME type após novo deploy)
 * e força reload automático para buscar os novos arquivos.
 */
function lazyChunk<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("mime") ||
        msg.includes("MIME") ||
        msg.includes("Failed to fetch") ||
        msg.includes("Loading chunk") ||
        msg.includes("dynamically imported module")
      ) {
        // Reload uma vez para pegar os novos chunks do deploy
        const reloaded = sessionStorage.getItem("chunk_reload");
        if (!reloaded) {
          sessionStorage.setItem("chunk_reload", "1");
          window.location.reload();
        }
      }
      throw err;
    })
  );
}

// Route-based code splitting (lazyChunk auto-reloads on MIME type errors after deploy)
const Dashboard        = lazyChunk(() => import("./pages/Dashboard"));
const Contacts         = lazyChunk(() => import("./pages/Contacts"));
const Companies        = lazyChunk(() => import("./pages/Companies"));
const Deals            = lazyChunk(() => import("./pages/Deals"));
const DealDetail       = lazyChunk(() => import("./pages/DealDetail"));
const Activities       = lazyChunk(() => import("./pages/Activities"));
const Tasks            = lazyChunk(() => import("./pages/Tasks"));
const Inbox            = lazyChunk(() => import("./pages/Inbox"));
const Conversations    = lazyChunk(() => import("./pages/Conversations"));
const EmailTemplates   = lazyChunk(() => import("./pages/EmailTemplates"));
const EmailSequences   = lazyChunk(() => import("./pages/EmailSequences"));
const LeadScoring      = lazyChunk(() => import("./pages/LeadScoring"));
const Reports          = lazyChunk(() => import("./pages/Reports"));
const Automations      = lazyChunk(() => import("./pages/Automations"));
const Settings         = lazyChunk(() => import("./pages/Settings"));
const Integrations     = lazyChunk(() => import("./pages/Integrations"));
const SecuritySettings = lazyChunk(() => import("./pages/SecuritySettings"));
const SalesGoals       = lazyChunk(() => import("./pages/SalesGoals"));
const Team             = lazyChunk(() => import("./pages/Team"));
const Setup            = lazyChunk(() => import("./pages/Setup"));
const Leads            = lazyChunk(() => import("./pages/Leads"));
const Marketing        = lazyChunk(() => import("./pages/Marketing"));
const MarketingOverview = lazyChunk(() => import("./pages/marketing/Overview"));
const InboxMarketing   = lazyChunk(() => import("./pages/InboxMarketing"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineDetector />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/setup" element={<SuspenseRoute><Setup /></SuspenseRoute>} />
              
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<SuspenseRoute><Dashboard /></SuspenseRoute>} />
                <Route path="/leads" element={<SuspenseRoute><Leads /></SuspenseRoute>} />
                <Route path="/contacts" element={<SuspenseRoute><Contacts /></SuspenseRoute>} />
                <Route path="/companies" element={<SuspenseRoute><Companies /></SuspenseRoute>} />
                <Route path="/deals" element={<SuspenseRoute><Deals /></SuspenseRoute>} />
                <Route path="/deals/:id" element={<SuspenseRoute><DealDetail /></SuspenseRoute>} />
                <Route path="/activities" element={<SuspenseRoute><Activities /></SuspenseRoute>} />
                <Route path="/tasks" element={<SuspenseRoute><Tasks /></SuspenseRoute>} />
                <Route path="/inbox" element={<SuspenseRoute><Inbox /></SuspenseRoute>} />
                <Route path="/conversations" element={<SuspenseRoute><Conversations /></SuspenseRoute>} />
                <Route path="/email-templates" element={<SuspenseRoute><EmailTemplates /></SuspenseRoute>} />
                <Route path="/email-sequences" element={<SuspenseRoute><EmailSequences /></SuspenseRoute>} />
                <Route path="/lead-scoring" element={<SuspenseRoute><LeadScoring /></SuspenseRoute>} />
                <Route path="/reports" element={<SuspenseRoute><Reports /></SuspenseRoute>} />
                <Route path="/automations" element={<SuspenseRoute><Automations /></SuspenseRoute>} />
                <Route path="/sales-goals" element={<SuspenseRoute><SalesGoals /></SuspenseRoute>} />
                <Route path="/marketing" element={<SuspenseRoute><Marketing /></SuspenseRoute>}>
                  <Route path="visao-geral" element={<SuspenseRoute><MarketingOverview /></SuspenseRoute>} />
                  <Route path="inbox" element={<SuspenseRoute><InboxMarketing /></SuspenseRoute>} />
                </Route>
                <Route path="/settings" element={<SuspenseRoute><Settings /></SuspenseRoute>} />
                <Route path="/settings/integrations" element={<SuspenseRoute><Integrations /></SuspenseRoute>} />
                <Route path="/settings/security" element={<SuspenseRoute><SecuritySettings /></SuspenseRoute>} />
                <Route path="/team" element={<SuspenseRoute><Team /></SuspenseRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
