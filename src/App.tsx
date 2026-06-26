import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { DealDrawerProvider } from "./contexts/DealDrawer";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { AreaProvider } from "./contexts/AreaContext";
import { CommandPalette } from "./components/CommandPalette";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { PreferencesDialogContext } from "./contexts/PreferencesDialogContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminOnlyRoute } from "./components/AdminOnlyRoute";
import { SuperAdminOnlyRoute } from "./components/SuperAdminOnlyRoute";
import { RequireArea } from "./components/RequireArea";
import ScrollToTop from "./components/ScrollToTop";
import { PageTransition } from "./components/PageTransition";
import { TutorialProvider } from "./contexts/TutorialContext";

// Páginas carregadas sob demanda (code-splitting) — reduz o bundle inicial.
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const MinhaCarteira = lazy(() => import("./pages/MinhaCarteira.tsx"));
const Tv = lazy(() => import("./pages/Tv.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const SetPassword = lazy(() => import("./pages/SetPassword.tsx"));
const SucessoDashboard = lazy(() => import("./pages/sucesso/Dashboard"));
const SucessoChurn = lazy(() => import("./pages/sucesso/Churn"));
const SucessoInatividade = lazy(() => import("./pages/sucesso/Inatividade"));
const SucessoClientes = lazy(() => import("./pages/sucesso/Clientes"));
const SucessoLista = lazy(() => import("./pages/sucesso/Lista"));
const SucessoKanban = lazy(() => import("./pages/sucesso/Kanban"));
const SucessoGestor = lazy(() => import("./pages/sucesso/AreaGestor"));
const SucessoConfig = lazy(() => import("./pages/sucesso/Config"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const Shell = () => {
  const [prefsOpen, setPrefsOpen] = useState(false);
  return (
    <PreferencesDialogContext.Provider value={{ open: () => setPrefsOpen(true) }}>
      <ScrollToTop />
      <PageTransition>
        <Suspense fallback={<div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/acesso-dash" element={<SetPassword />} />
          <Route path="/" element={<ProtectedRoute viewerAllowed><RequireArea area="onboarding"><Index /></RequireArea></ProtectedRoute>} />
          <Route path="/minha-carteira" element={<ProtectedRoute><RequireArea area="onboarding"><MinhaCarteira /></RequireArea></ProtectedRoute>} />
          <Route path="/tv" element={<ProtectedRoute><RequireArea area="onboarding"><Tv /></RequireArea></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/sucesso" element={<ProtectedRoute viewerAllowed><RequireArea area="sucesso"><SucessoDashboard /></RequireArea></ProtectedRoute>} />
          <Route path="/sucesso/churn" element={<ProtectedRoute viewerAllowed><RequireArea area="sucesso"><SucessoChurn /></RequireArea></ProtectedRoute>} />
          <Route path="/sucesso/inatividade" element={<ProtectedRoute><SuperAdminOnlyRoute><SucessoInatividade /></SuperAdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/clientes" element={<ProtectedRoute><AdminOnlyRoute><SucessoClientes /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/lista" element={<ProtectedRoute><AdminOnlyRoute><SucessoLista /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/kanban" element={<ProtectedRoute><AdminOnlyRoute><SucessoKanban /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/gestor" element={<ProtectedRoute><AdminOnlyRoute><SucessoGestor /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/config" element={<ProtectedRoute><AdminOnlyRoute><SucessoConfig /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </PageTransition>
      <CommandPalette onOpenPreferences={() => setPrefsOpen(true)} />
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </PreferencesDialogContext.Provider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PreferencesProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AreaProvider>
            <AuthProvider>
              <NotificationsProvider>
                <DealDrawerProvider>
                  <TutorialProvider>
                    <Shell />
                  </TutorialProvider>
                </DealDrawerProvider>
              </NotificationsProvider>
            </AuthProvider>
          </AreaProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PreferencesProvider>
  </QueryClientProvider>
);

export default App;
